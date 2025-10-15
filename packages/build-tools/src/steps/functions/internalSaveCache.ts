import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  spawnAsync,
} from '@expo/steps';
import { Platform } from '@expo/eas-build-job';
import nullthrows from 'nullthrows';
import { asyncResult } from '@expo/results';
import fs from 'fs-extra';

import { generateCacheKeyAsync } from '../../utils/cacheKey';

import { compressCacheAsync, uploadCacheAsync } from './saveCache';

export function createInternalSaveCacheFunction(
  cacheKeyPrefix: string,
  cachePaths: string[],
  buildStartTime: number
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: `__save_cache_${cacheKeyPrefix.replace(/-/g, '_')}`,
    name: `Save Cache (${cacheKeyPrefix})`,
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'working_directory',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'platform',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async (stepCtx, { env, inputs }) => {
      const { logger } = stepCtx;

      const shouldSave =
        env.EAS_SAVE_CACHE === '1' || (env.EAS_USE_CACHE === '1' && env.EAS_SAVE_CACHE !== '0');

      if (!shouldSave) {
        logger.info('Cache save is disabled');
        return;
      }

      try {
        const workingDirectory = String(inputs.working_directory.value);
        const platform = String(inputs.platform.value) as Platform;

        const cacheKey = await generateCacheKeyAsync(workingDirectory, cacheKeyPrefix);

        const jobId = nullthrows(env.EAS_BUILD_ID, 'EAS_BUILD_ID is not set');
        const robotAccessToken = nullthrows(
          stepCtx.global.staticContext.job.secrets?.robotAccessToken,
          'Robot access token is required for cache operations'
        );
        const expoApiServerURL = nullthrows(env.__API_SERVER_URL, '__API_SERVER_URL is not set');

        // Cache size can blow up over time over many builds, so evict stale files
        // and only upload what was used within this build's time window
        const evictWindow = Math.floor((Date.now() - buildStartTime) / 1000);
        logger.info('Pruning cache...');
        await asyncResult(
          spawnAsync('ccache', ['--evict-older-than', evictWindow + 's'], {
            env,
            logger,
            stdio: 'pipe',
          })
        );

        logger.info('Cache stats:');
        await asyncResult(
          spawnAsync('ccache', ['--show-stats', '-v'], {
            env,
            logger,
            stdio: 'pipe',
          })
        );

        logger.info('Preparing cache archive...');

        const { archivePath } = await compressCacheAsync({
          paths: cachePaths,
          workingDirectory,
          verbose: env.EXPO_DEBUG === '1',
          logger,
        });

        const { size } = await fs.stat(archivePath);

        await uploadCacheAsync({
          logger,
          jobId,
          expoApiServerURL,
          robotAccessToken,
          archivePath,
          key: cacheKey,
          paths: cachePaths,
          size,
          platform,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to save cache');
      }
    },
  });
}
