import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  spawnAsync,
} from '@expo/steps';
import { Platform } from '@expo/eas-build-job';
import nullthrows from 'nullthrows';
import { asyncResult } from '@expo/results';

import { generateDefaultBuildCacheKeyAsync } from '../../utils/cacheKey';
import { ANDROID_CACHE_KEY_PREFIX, IOS_CACHE_KEY_PREFIX } from '../../utils/constants';

import { downloadCacheAsync, decompressCacheAsync } from './restoreCache';

export function createInternalRestoreCacheFunction(cachePaths: string[]): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'restore_build_cache',
    name: 'Restore Cache',
    inputProviders: [
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
        const workingDirectory = stepCtx.workingDirectory;
        const platform = String(inputs.platform.value) as Platform;
        const prefix = platform === Platform.IOS ? IOS_CACHE_KEY_PREFIX : ANDROID_CACHE_KEY_PREFIX;

        const cacheKey = await generateDefaultBuildCacheKeyAsync(workingDirectory, platform);

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
          keyPrefixes: [prefix],
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
