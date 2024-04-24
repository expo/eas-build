import { Platform, Workflow } from '@expo/eas-build-job';
import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  BuildStepOutput,
} from '@expo/steps';

import { resolveRuntimeVersionForExpoUpdatesIfConfiguredAsync } from '../../utils/expoUpdates';
import { readAppConfig } from '../../utils/appConfig';
import { CustomBuildContext } from '../../customBuildContext';

export function calculateEASUpdateRuntimeVersionFunction(ctx: CustomBuildContext): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'calculate_eas_update_runtime_version',
    name: 'Calculate EAS Update Runtime Version',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'platform',
        defaultValue: ctx.job.platform,
        required: !ctx.job.platform,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'workflow',
        defaultValue: ctx.job.type,
        required: !ctx.job.type,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    outputProviders: [
      BuildStepOutput.createProvider({
        id: 'resolved_eas_update_runtime_version',
        required: false,
      }),
    ],
    fn: async (stepCtx, { env, inputs, outputs }) => {
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
        platform: inputs.platform.value as Platform,
        workflow: inputs.workflow.value as Workflow,
      });
      if (resolvedRuntimeVersion) {
        outputs.resolved_eas_update_runtime_version.set(resolvedRuntimeVersion);
      } else {
        stepCtx.logger.info('Skipped because EAS Update is not configured');
      }
    },
  });
}
