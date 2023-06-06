import { Job } from '@expo/eas-build-job';
import { BuildFunction, BuildStepInput } from '@expo/steps';
import nullthrows from 'nullthrows';

import { BuildContext } from '../../context';
import { runGradleCommand } from '../../android/gradle';

export function createRunGradleBuildFunction<T extends Job>(ctx: BuildContext<T>): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'run_gradle',
    name: 'Run Gradle',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'gradle_command',
        defaultValue: ':app:bundleRelease',
      }),
    ],
    fn: async (stepsCtx, { inputs }) => {
      // TODO: resolve extra envs for GH builds using resolveVersionOverridesEnvs function when adding GH builds support
      await runGradleCommand(ctx, {
        logger: stepsCtx.logger,
        gradleCommand: nullthrows(inputs.gradle_command.value),
        androidDir: stepsCtx.workingDirectory,
      });
    },
  });
}
