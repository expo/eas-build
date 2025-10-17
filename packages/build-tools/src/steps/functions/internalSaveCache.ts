import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { saveCcacheAsync } from './saveCache';

export function createInternalSaveCacheFunction(buildStartTime: number): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'save_build_cache',
    name: 'Save Cache',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'platform',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async (stepCtx, { env, inputs }) => {
      const { logger } = stepCtx;
      const workingDirectory = stepCtx.workingDirectory;
      const platform = String(inputs.platform.value) as Platform;

      await saveCcacheAsync({
        logger,
        workingDirectory,
        platform,
        buildStartTime,
        env,
        secrets: stepCtx.global.staticContext.job.secrets,
      });
    },
  });
}
