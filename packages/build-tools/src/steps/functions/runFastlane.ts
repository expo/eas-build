import { BuildFunction, BuildStepOutput } from '@expo/steps';

import { runFastlaneGym } from '../utils/ios/fastlane';
import { BuildStatusText, BuildStepOutputName } from '../utils/slackMessageDynamicFields';

export function runFastlaneFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'run_fastlane',
    name: 'Run fastlane',
    outputProviders: [
      BuildStepOutput.createProvider({
        id: BuildStepOutputName.STATUS_TEXT,
        required: true,
      }),
      BuildStepOutput.createProvider({
        id: BuildStepOutputName.ERROR_TEXT,
        required: false,
      }),
    ],
    fn: async (stepCtx, { env, outputs }) => {
      outputs[BuildStepOutputName.STATUS_TEXT].set(BuildStatusText.STARTED);
      try {
        await runFastlaneGym({
          workingDir: stepCtx.workingDirectory,
          env: Object.keys(env).reduce(
            (acc, key) => {
              acc[key] = env[key] ?? '';
              return acc;
            },
            {} as Record<string, string>
          ),
          logger: stepCtx.logger,
          buildLogsDirectory: stepCtx.global.buildLogsDirectory,
        });
      } catch (error) {
        outputs[BuildStepOutputName.STATUS_TEXT].set(BuildStatusText.ERROR);
        outputs[BuildStepOutputName.ERROR_TEXT].set((error as Error).toString());
        throw error;
      }
      outputs[BuildStepOutputName.STATUS_TEXT].set(BuildStatusText.SUCCESS);
    },
  });
}
