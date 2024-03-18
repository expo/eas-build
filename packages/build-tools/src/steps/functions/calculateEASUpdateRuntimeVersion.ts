import { BuildFunction, BuildStepOutput } from '@expo/steps';

import { resolveRuntimeVersionForExpoUpdatesIfConfiguredAsync } from '../../utils/expoUpdates';
import { readAppConfig } from '../../utils/appConfig';

export function calculateEASUpdateRuntimeVersionFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'calculate_eas_update_runtime_version',
    name: 'Calculate EAS Update Runtime Version',
    outputProviders: [
      BuildStepOutput.createProvider({
        id: 'resolved_eas_update_runtime_version',
        required: false,
      }),
    ],
    fn: async (stepCtx, { env, outputs }) => {
      const appConfig = readAppConfig({
        projectDir: stepCtx.workingDirectory,
        env: Object.keys(env).reduce(
          (acc, key) => {
            acc[key] = env[key] ?? '';
            return acc;
          },
          {} as Record<string, string>
        ),
        logger: stepCtx.logger,
        sdkVersion: stepCtx.global.staticContext.metadata?.sdkVersion,
      }).exp;
      const resolvedRuntimeVersion = await resolveRuntimeVersionForExpoUpdatesIfConfiguredAsync({
        cwd: stepCtx.workingDirectory,
        logger: stepCtx.logger,
        appConfig,
        platform: stepCtx.global.staticContext.job.platform,
      });
      if (resolvedRuntimeVersion) {
        outputs.resolved_eas_update_runtime_version.set(resolvedRuntimeVersion);
      } else {
        stepCtx.logger.info('Skipped because EAS Update is not configured');
      }
    },
  });
}
