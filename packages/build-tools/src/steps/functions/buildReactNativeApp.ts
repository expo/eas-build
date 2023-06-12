import path from 'path';

import { Android, Job, Platform } from '@expo/eas-build-job';
import { BuildFunction, errors } from '@expo/steps';
import fs from 'fs-extra';

import { BuildContext } from '../../context';
import { resolveGradleCommand, runGradleCommand } from '../../android/gradle';

export function createBuildReactNativeAppBuildFunction<T extends Job>(
  ctx: BuildContext<T>
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'build_react_native_app',
    name: 'Build React Native app',
    fn: async (stepsCtx) => {
      if (ctx.job.platform === Platform.ANDROID) {
        const androidDir = path.join(stepsCtx.workingDirectory, 'android');
        if (!(await fs.exists(androidDir))) {
          throw new errors.BuildStepRuntimeError(
            `Android project directory (${androidDir}) does not exist. Make sure that the working directory for this step (${stepsCtx.workingDirectory}) is set to the root of your React Native project. If you are on a managed workflow, make sure that you have run "eas/prebuild" step to generate your native code.`
          );
        }
        stepsCtx.logger.info('Building Android project');
        await runGradleCommand(ctx as BuildContext<Android.Job>, {
          logger: stepsCtx.logger,
          gradleCommand: resolveGradleCommand(ctx.job),
          androidDir,
        });
      } else {
        throw new errors.BuildStepRuntimeError('iOS builds are not supported yet');
      }
    },
  });
}
