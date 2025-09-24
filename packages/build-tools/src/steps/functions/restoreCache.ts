import fs from 'fs';
import os from 'os';
import path from 'path';
import stream from 'stream';
import { promisify } from 'util';

import * as tar from 'tar';
import { bunyan } from '@expo/logger';
import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  BuildStepOutput,
} from '@expo/steps';
import z from 'zod';
import nullthrows from 'nullthrows';
import fetch from 'node-fetch';
import { asyncResult } from '@expo/results';
import { Platform } from '@expo/eas-build-job';

import { retryOnDNSFailure } from '../../utils/retryOnDNSFailure';
import { formatBytes } from '../../utils/artifacts';
import { getCacheVersion } from '../utils/cache';
import { turtleFetch } from '../../utils/turtleFetch';

const streamPipeline = promisify(stream.pipeline);

export function createRestoreCacheFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'restore_cache',
    name: 'Restore Cache',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'path',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'key',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'restore_keys',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    outputProviders: [
      BuildStepOutput.createProvider({
        id: 'cache_hit',
        required: false,
      }),
    ],
    fn: async (stepsCtx, { env, inputs, outputs }) => {
      const { logger } = stepsCtx;

      try {
        if (stepsCtx.global.staticContext.job.platform) {
          logger.error('Caches are not supported in build jobs yet.');
          return;
        }

        const paths = z
          .array(z.string())
          .parse(((inputs.path.value ?? '') as string).split(/[\r\n]+/))
          .filter((path) => path.length > 0);
        const key = z.string().parse(inputs.key.value);
        const restoreKeys = z
          .array(z.string())
          .parse(((inputs.restore_keys.value ?? '') as string).split(/[\r\n]+/))
          .filter((key) => key !== '');

        const jobId = nullthrows(env.EAS_BUILD_ID, 'EAS_BUILD_ID is not set');
        const robotAccessToken = nullthrows(
          stepsCtx.global.staticContext.job.secrets?.robotAccessToken
        );

        const { archivePath, matchedKey } = await downloadCacheAsync({
          logger,
          jobId,
          expoApiServerURL: stepsCtx.global.staticContext.expoApiServerURL,
          robotAccessToken,
          paths,
          key,
          keyPrefixes: restoreKeys,
          platform: stepsCtx.global.staticContext.job.platform,
        });

        const { size } = await fs.promises.stat(archivePath);
        logger.info(`Downloaded cache archive from ${archivePath} (${formatBytes(size)}).`);

        await decompressCacheAsync({
          archivePath,
          workingDirectory: stepsCtx.workingDirectory,
          verbose: true,
          logger,
        });

        outputs.cache_hit.set(`${matchedKey === key}`);
      } catch (error) {
        logger.error({ err: error }, 'Failed to restore cache');
      }
    },
  });
}

export async function downloadCacheAsync({
  logger,
  jobId,
  expoApiServerURL,
  robotAccessToken,
  paths,
  key,
  keyPrefixes,
  platform,
}: {
  logger: bunyan;
  jobId: string;
  expoApiServerURL: string;
  robotAccessToken: string;
  paths: string[];
  key: string;
  keyPrefixes: string[];
  platform: Platform | undefined;
}): Promise<{ archivePath: string; matchedKey: string }> {
  const routerURL = platform ? 'v2/turtle-builds/caches/download' : 'v2/turtle-caches/download';
  const response = await turtleFetch(new URL(routerURL, expoApiServerURL).toString(), 'POST', {
    json: platform
      ? {
          buildId: jobId,
          key,
          version: getCacheVersion(paths),
          keyPrefixes,
        }
      : {
          jobRunId: jobId,
          key,
          version: getCacheVersion(paths),
          keyPrefixes,
        },
    headers: {
      Authorization: `Bearer ${robotAccessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `No cache found for this key, ensure it was created with eas/save_cache (${response.status})`
      );
    }
    const textResult = await asyncResult(response.text());
    throw new Error(`Unexpected response from server (${response.status}): ${textResult.value}`);
  }

  const result = await asyncResult(response.json());
  if (!result.ok) {
    throw new Error(`Unexpected response from server (${response.status}): ${result.reason}`);
  }

  const { matchedKey, downloadUrl } = result.value.data;

  logger.info(`Matched cache key: ${matchedKey}. Downloading...`);

  const downloadDestinationDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'restore-cache-')
  );

  const downloadResponse = await retryOnDNSFailure(fetch)(downloadUrl);
  if (!downloadResponse.ok) {
    throw new Error(
      `Unexpected response from cache server (${downloadResponse.status}): ${downloadResponse.statusText}`
    );
  }

  // URL may contain percent-encoded characters, e.g. my%20file.apk
  // this replaces all non-alphanumeric characters (excluding dot) with underscore
  const archiveFilename = path
    .basename(new URL(downloadUrl).pathname)
    .replace(/([^a-z0-9.-]+)/gi, '_');
  const archivePath = path.join(downloadDestinationDirectory, archiveFilename);

  await streamPipeline(downloadResponse.body, fs.createWriteStream(archivePath));

  return { archivePath, matchedKey };
}

export async function decompressCacheAsync({
  archivePath,
  workingDirectory,
  verbose,
  logger,
}: {
  archivePath: string;
  workingDirectory: string;
  verbose: boolean;
  logger: bunyan;
}): Promise<void> {
  if (verbose) {
    logger.info(`Extracting cache to ${workingDirectory}:`);
  }

  // First, extract everything to the working directory
  const fileHandle = await fs.promises.open(archivePath, 'r');
  const extractedFiles: string[] = [];

  await streamPipeline(
    fileHandle.createReadStream(),
    tar.extract({
      cwd: workingDirectory,
      onwarn: (code, message, data) => {
        logger.warn({ code, data }, message);
      },
      preservePaths: true,
      onReadEntry: (entry) => {
        extractedFiles.push(entry.path);
        if (verbose) {
          logger.info(`- ${entry.path}`);
        }
      },
    })
  );

  // Handle absolute paths that were prefixed with __absolute__
  for (const extractedPath of extractedFiles) {
    if (extractedPath.startsWith('__absolute__/')) {
      const originalAbsolutePath = extractedPath.slice('__absolute__'.length);
      const currentPath = path.join(workingDirectory, extractedPath);

      try {
        // Ensure the target directory exists
        await fs.promises.mkdir(path.dirname(originalAbsolutePath), { recursive: true });

        // Move the file to its original absolute location
        await fs.promises.rename(currentPath, originalAbsolutePath);

        if (verbose) {
          logger.info(`Moved ${extractedPath} to ${originalAbsolutePath}`);
        }
      } catch (error) {
        logger.warn(`Failed to restore absolute path ${originalAbsolutePath}: ${error}`);
      }
    }
  }

  // Clean up any remaining __absolute__ directories
  const absoluteDir = path.join(workingDirectory, '__absolute__');
  if (
    await fs.promises
      .access(absoluteDir)
      .then(() => true)
      .catch(() => false)
  ) {
    await fs.promises.rm(absoluteDir, { recursive: true, force: true });
  }
}
