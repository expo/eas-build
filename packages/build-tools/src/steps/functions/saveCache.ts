import fs from 'fs';
import os from 'os';
import path from 'path';

import * as tar from 'tar';
import { bunyan } from '@expo/logger';
import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import z from 'zod';
import nullthrows from 'nullthrows';
import fetch from 'node-fetch';
import { asyncResult } from '@expo/results';

import { retryOnDNSFailure } from '../../utils/retryOnDNSFailure';
import { formatBytes } from '../../utils/artifacts';
import { getCacheVersion } from '../utils/cache';

export function createSaveCacheFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'save_cache',
    name: 'Save Cache',
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
    ],
    fn: async (stepsCtx, { env, inputs }) => {
      const { logger } = stepsCtx;

      try {
        if (stepsCtx.global.staticContext.job.platform) {
          logger.error('Caches are not supported in build jobs yet.');
          return;
        }

        const paths = z
          .array(z.string())
          .parse(((inputs.path.value ?? '') as string).split(/[\r\n]+/));
        const key = z.string().parse(inputs.key.value);
        const taskId = nullthrows(env.EAS_BUILD_ID, 'EAS_BUILD_ID is not set');

        const { archivePath } = await compressCacheAsync({
          paths,
          workingDirectory: stepsCtx.workingDirectory,
          verbose: true,
          logger,
        });

        await uploadCacheAsync({
          logger,
          jobRunId: taskId,
          expoApiServerURL: stepsCtx.global.staticContext.expoApiServerURL,
          robotAccessToken: stepsCtx.global.staticContext.job.secrets?.robotAccessToken ?? null,
          archivePath,
          key,
          paths,
        });

        const { size } = await fs.promises.stat(archivePath);

        logger.info(`Uploaded cache archive to ${archivePath} (${formatBytes(size)}).`);
      } catch (error) {
        logger.error({ err: error }, 'Failed to restore cache');
      }
    },
  });
}

export async function uploadCacheAsync({
  logger,
  jobRunId,
  expoApiServerURL,
  robotAccessToken,
  paths,
  key,
  archivePath,
}: {
  logger: bunyan;
  jobRunId: string;
  expoApiServerURL: string;
  robotAccessToken: string;
  paths: string[];
  key: string;
  archivePath: string;
}): Promise<void> {
  const response = await retryOnDNSFailure(fetch)(
    new URL(`/v2/turtle-job-runs/${jobRunId}/request-cache-upload-session`, expoApiServerURL),
    {
      method: 'POST',
      body: JSON.stringify({ key, version: getCacheVersion(paths) }),
      headers: { Authorization: `Bearer ${robotAccessToken}` },
    }
  );

  if (!response.ok) {
    const textResult = await asyncResult(response.text());
    throw new Error(`Unexpected response from server (${response.status}): ${textResult.value}`);
  }

  const result = await asyncResult(response.json());
  if (!result.ok) {
    throw new Error(`Unexpected response from server (${response.status}): ${result.reason}`);
  }

  const { url, headers } = result.value;

  logger.info(`Uploading cache...`);

  const uploadResponse = await retryOnDNSFailure(fetch)(url, {
    method: 'PUT',
    headers,
    body: fs.createReadStream(archivePath),
  });
  if (!uploadResponse.ok) {
    throw new Error(
      `Unexpected response from cache server (${uploadResponse.status}): ${uploadResponse.statusText}`
    );
  }
}

export async function compressCacheAsync({
  paths,
  workingDirectory,
  verbose,
  logger,
}: {
  paths: string[];
  workingDirectory: string;
  verbose: boolean;
  logger: bunyan;
}): Promise<{ archivePath: string }> {
  const archiveDestinationDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'save-cache-')
  );

  const archivePath = path.join(archiveDestinationDirectory, 'cache.tar.gz');

  if (verbose) {
    logger.info(`Compressing cache to ${workingDirectory}:`);
  }

  await tar.c(
    {
      gzip: true,
      file: archivePath,
      cwd: workingDirectory,
      onWriteEntry: verbose
        ? (entry) => {
            logger.info(`- ${entry.path}`);
          }
        : undefined,
    },
    paths
  );

  return { archivePath };
}
