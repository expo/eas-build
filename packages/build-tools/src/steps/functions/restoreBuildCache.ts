import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { restoreCcacheAsync } from './restoreCache';

export function createRestoreBuildCacheFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'restore_build_cache',
    name: 'Restore Cache',
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

      await restoreCcacheAsync({
        logger,
        workingDirectory,
        platform,
        env,
        secrets: stepCtx.global.staticContext.job.secrets,
      });
    },
  });
}
