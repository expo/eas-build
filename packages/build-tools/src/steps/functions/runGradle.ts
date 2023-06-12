import { Android, Job, Platform } from '@expo/eas-build-job';
import { BuildFunction, BuildStepInput, errors } from '@expo/steps';
import nullthrows from 'nullthrows';

import { BuildContext } from '../../context';
import { runGradleCommand } from '../../android/gradle';

export function createRunGradleBuildFunction<T extends Job>(ctx: BuildContext<T>): BuildFunction {
  return new BuildFunction({
    namespace: 'utils',
    id: 'run_gradle',
    name: 'Run Gradle',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'gradle_command',
        defaultValue: ':app:bundleRelease',
      }),
    ],
    fn: async (stepsCtx, { inputs }) => {
      if (ctx.job.platform !== Platform.ANDROID) {
        throw new errors.BuildStepRuntimeError('This step is only supported for Android');
      }
      await runGradleCommand(ctx as BuildContext<Android.Job>, {
        logger: stepsCtx.logger,
        gradleCommand: nullthrows(inputs.gradle_command.value).toString(),
        androidDir: stepsCtx.workingDirectory,
      });
    },
  });
}
