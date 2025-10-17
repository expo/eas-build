import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { saveCcacheAsync } from './saveCache';

export function createInternalSaveCacheFunction(
  cachePaths: string[],
  buildStartTime: number
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'save_build_cache',
    name: 'Save Cache',
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
      const workingDirectory = String(inputs.working_directory.value);
      const platform = String(inputs.platform.value) as Platform;

      await saveCcacheAsync({
        logger,
        workingDirectory,
        platform,
        buildStartTime,
        cachePaths,
        env,
        secrets: stepCtx.global.staticContext.job.secrets,
      });
    },
  });
}
