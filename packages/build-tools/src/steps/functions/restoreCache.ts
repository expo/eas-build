import fs from 'fs';
import os from 'os';
import assert from 'assert';
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
  spawnAsync,
} from '@expo/steps';
import z from 'zod';
import nullthrows from 'nullthrows';
import fetch from 'node-fetch';
import { asyncResult } from '@expo/results';
import { Platform } from '@expo/eas-build-job';

import { retryOnDNSFailure } from '../../utils/retryOnDNSFailure';
import { formatBytes } from '../../utils/artifacts';
import { getCacheVersion } from '../utils/cache';
import { turtleFetch, TurtleFetchError } from '../../utils/turtleFetch';
import { generateDefaultBuildCacheKeyAsync } from '../../utils/cacheKey';
import {
  ANDROID_CACHE_KEY_PREFIX,
  ANDROID_CACHE_PATH,
  IOS_CACHE_KEY_PREFIX,
  IOS_CACHE_PATH,
} from '../../utils/constants';

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
          stepsCtx.global.staticContext.job.secrets?.robotAccessToken,
          'robotAccessToken is not set'
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

  try {
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
      // It's ok to retry POST caches/download, because we're only retrying signing a download URL.
      retries: 2,
      shouldThrowOnNotOk: true,
    });

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
  } catch (err: any) {
    if (err instanceof TurtleFetchError && err.response.status !== 404) {
      const textResult = await asyncResult(err.response.text());
      throw new Error(
        `Unexpected response from server (${err.response.status}): ${textResult.value}`
      );
    }
    throw err;
  }
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

export async function restoreCcacheAsync({
  logger,
  workingDirectory,
  platform,
  env,
  secrets,
}: {
  logger: bunyan;
  workingDirectory: string;
  platform: Platform;
  env: Record<string, string | undefined>;
  secrets?: { robotAccessToken?: string };
}): Promise<void> {
  const enabled =
    env.EAS_RESTORE_CACHE === '1' || (env.EAS_USE_CACHE === '1' && env.EAS_RESTORE_CACHE !== '0');

  if (!enabled) {
    return;
  }
  try {
    const cacheKey = await generateDefaultBuildCacheKeyAsync(workingDirectory, platform);

    const jobId = nullthrows(env.EAS_BUILD_ID, 'EAS_BUILD_ID is not set');
    const robotAccessToken = nullthrows(
      secrets?.robotAccessToken,
      'Robot access token is required for cache operations'
    );
    const expoApiServerURL = nullthrows(env.__API_SERVER_URL, '__API_SERVER_URL is not set');
    assert(
      env.HOME,
      'Failed to infer directory to restore ccache: $HOME environment variable is empty.'
    );
    const cachePaths = [
      path.join(env.HOME, platform === Platform.IOS ? IOS_CACHE_PATH : ANDROID_CACHE_PATH),
    ];
    const { archivePath } = await downloadCacheAsync({
      logger,
      jobId,
      expoApiServerURL,
      robotAccessToken,
      paths: cachePaths,
      key: cacheKey,
      keyPrefixes: [platform === Platform.IOS ? IOS_CACHE_KEY_PREFIX : ANDROID_CACHE_KEY_PREFIX],
      platform,
    });

    await decompressCacheAsync({
      archivePath,
      workingDirectory,
      verbose: env.EXPO_DEBUG === '1',
      logger,
    });

    logger.info('Cache restored successfully');

    // Zero ccache stats for accurate tracking
    await asyncResult(
      spawnAsync('ccache', ['--zero-stats'], {
        env,
        logger,
        stdio: 'pipe',
      })
    );
  } catch (err: any) {
    if (err.response?.status === 404) {
      logger.info('No cache found for this key. Create a cache with function save_cache');
    } else {
      logger.warn({ err }, 'Failed to restore cache');
    }
  }
}
