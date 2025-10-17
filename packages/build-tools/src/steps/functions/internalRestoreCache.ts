import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { restoreCcacheAsync } from './restoreCache';

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
      const workingDirectory = stepCtx.workingDirectory;
      const platform = String(inputs.platform.value) as Platform;

      await restoreCcacheAsync({
        logger,
        workingDirectory,
        platform,
        cachePaths,
        env,
        secrets: stepCtx.global.staticContext.job.secrets,
      });
    },
  });
}
