import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  spawnAsync,
} from '@expo/steps';
import { Platform } from '@expo/eas-build-job';
import nullthrows from 'nullthrows';
import { asyncResult } from '@expo/results';

import { generateCacheKeyAsync } from '../../utils/cacheKey';

import { downloadCacheAsync, decompressCacheAsync } from './restoreCache';

export function createInternalRestoreCacheFunction(
  cacheKeyPrefix: string,
  cachePaths: string[]
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: `__restore_cache_${cacheKeyPrefix.replace(/-/g, '_')}`,
    name: `Restore Cache (${cacheKeyPrefix})`,
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

      const shouldRestore =
        env.EAS_RESTORE_CACHE === '1' ||
        (env.EAS_USE_CACHE === '1' && env.EAS_RESTORE_CACHE !== '0');

      if (!shouldRestore) {
        logger.info('Cache restore is disabled');
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

        const { archivePath } = await downloadCacheAsync({
          logger,
          jobId,
          expoApiServerURL,
          robotAccessToken,
          paths: cachePaths,
          key: cacheKey,
          keyPrefixes: [cacheKeyPrefix],
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
    },
  });
}
