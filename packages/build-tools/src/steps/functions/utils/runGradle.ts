import { Android, Job } from '@expo/eas-build-job';
import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import nullthrows from 'nullthrows';

import { BuildContext } from '../../../context';
import { runGradleCommand } from '../../../android/gradle';

export function createRunGradleBuildFunction<T extends Job>(ctx: BuildContext<T>): BuildFunction {
  return new BuildFunction({
    namespace: 'utils',
    id: 'run_gradle',
    name: 'Run Gradle',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'gradle_command',
        defaultValue: ':app:bundleRelease',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async (stepsCtx, { inputs }) => {
      await runGradleCommand(ctx as BuildContext<Android.Job>, {
        logger: stepsCtx.logger,
        gradleCommand: nullthrows(inputs.gradle_command.value).toString(),
        androidDir: stepsCtx.workingDirectory,
      });
    },
  });
}
