import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { saveCcacheAsync } from './saveCache';

export function createSaveBuildCacheFunction(evictUsedBefore: number): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'save_build_cache',
    name: 'Save Cache',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'platform',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async (stepCtx, { env, inputs }) => {
      const { logger } = stepCtx;
      const workingDirectory = stepCtx.workingDirectory;
      const platform =
        (inputs.platform.value as Platform) ?? stepCtx.global.staticContext.job.platform;

      await saveCcacheAsync({
        logger,
        workingDirectory,
        platform,
        evictUsedBefore,
        env,
        secrets: stepCtx.global.staticContext.job.secrets,
      });
    },
  });
}
