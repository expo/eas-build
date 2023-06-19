import path from 'path';

import { Android, Ios, Job, Platform } from '@expo/eas-build-job';
import { BuildFunction, errors } from '@expo/steps';
import fs from 'fs-extra';

import { BuildContext } from '../../../context';
import { resolveGradleCommand, runGradleCommand } from '../../../android/gradle';
import { resolveBuildConfiguration, resolveScheme } from '../../utils/ios/resolve';
import { runFastlaneGym } from '../../utils/ios/fastlane';

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
        const iosCtx = ctx as BuildContext<Ios.Job>;
        const iosDir = path.join(stepsCtx.workingDirectory, 'ios');
        if (!(await fs.exists(iosDir))) {
          throw new errors.BuildStepRuntimeError(
            `iOS project directory (${iosDir}) does not exist. Make sure that the working directory for this step (${stepsCtx.workingDirectory}) is set to the root of your React Native project. If you are on a managed workflow, make sure that you have run "eas/prebuild" step to generate your native code.`
          );
        }
        const scheme = resolveScheme(iosCtx.job, { workingDir: stepsCtx.workingDirectory });
        const buildConfiguration = resolveBuildConfiguration(iosCtx.job);
        await runFastlaneGym({
          scheme,
          buildConfiguration,
          workingDir: stepsCtx.workingDirectory,
          logger: stepsCtx.logger,
          buildLogsDirectory: ctx.buildLogsDirectory,
          env: ctx.env,
        });
      }
    },
  });
}
