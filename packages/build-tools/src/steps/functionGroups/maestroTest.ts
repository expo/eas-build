import {
  BuildFunctionGroup,
  BuildStep,
  BuildStepInput,
  BuildStepInputValueTypeName,
  spawnAsync,
} from '@expo/steps';
import { Platform } from '@expo/eas-build-job';
import fg from 'fast-glob';

import { CustomBuildContext } from '../../customBuildContext';
import { createInstallMaestroBuildFunction } from '../functions/installMaestro';
import { createStartIosSimulatorBuildFunction } from '../functions/startIosSimulator';
import { createStartAndroidEmulatorBuildFunction } from '../functions/startAndroidEmulator';
import { createUploadArtifactBuildFunction } from '../functions/uploadArtifact';

export function createEasMaestroTestFunctionGroup(
  buildToolsContext: CustomBuildContext
): BuildFunctionGroup {
  return new BuildFunctionGroup({
    namespace: 'eas',
    id: 'maestro_test',
    inputProviders: [
      BuildStepInput.createProvider({
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        id: 'flow_path',
        required: true,
      }),
    ],
    createBuildStepsFromFunctionGroupCall: (globalCtx, { inputs }) => {
      const steps: BuildStep[] = [
        createInstallMaestroBuildFunction().createBuildStepFromFunctionCall(globalCtx),
      ];

      if (buildToolsContext.job.platform === Platform.IOS) {
        steps.push(
          createStartIosSimulatorBuildFunction().createBuildStepFromFunctionCall(globalCtx)
        );
        steps.push(
          new BuildStep(globalCtx, {
            id: BuildStep.getNewId(),
            name: 'install_app',
            displayName: `Install app to Simulator`,
            fn: async (ctx, { env }) => {
              const searchPath = 'ios/build/Build/Products/*simulator/*.app';
              const appPaths = await fg(searchPath, { onlyFiles: true, cwd: ctx.workingDirectory });

              if (appPaths.length === 0) {
                ctx.logger.warn(
                  `No files found matching "${searchPath}". Are you sure you've built a Simulator app?`
                );
              }

              for (const appPath of appPaths) {
                ctx.logger.info(`Installing "${appPath}"`);
                await spawnAsync('xcrun', ['simctl', 'install', 'booted', appPath], {
                  env,
                  cwd: ctx.workingDirectory,
                });
              }
            },
          })
        );
      } else if (buildToolsContext.job.platform === Platform.ANDROID) {
        steps.push(
          createStartAndroidEmulatorBuildFunction().createBuildStepFromFunctionCall(globalCtx)
        );
        steps.push(
          new BuildStep(globalCtx, {
            id: BuildStep.getNewId(),
            name: 'install_app',
            displayName: `Install app to Emulator`,
            fn: async (ctx, { env }) => {
              const searchPath = 'android/app/build/outputs/**/*.apk';
              const appPaths = await fg(searchPath, { onlyFiles: true, cwd: ctx.workingDirectory });

              if (appPaths.length === 0) {
                ctx.logger.warn(
                  `No files found matching "${searchPath}". Are you sure you've built an Emulator app?`
                );
              }

              for (const appPath of appPaths) {
                ctx.logger.info(`Installing "${appPath}"`);
                await spawnAsync('adb', ['install', appPath], {
                  env,
                  cwd: ctx.workingDirectory,
                });
              }
            },
          })
        );
      }

      const flowPaths = `${inputs.flow_path.value}`
        .split('\n') // It's easy to get an empty line with YAML
        .filter((entry) => entry);
      for (const flowPath of flowPaths) {
        steps.push(
          new BuildStep(globalCtx, {
            id: BuildStep.getNewId(),
            name: 'maestro_test',
            ifCondition: '${ always() }',
            displayName: `maestro test ${flowPath}`,
            command: `maestro test ${flowPath}`,
          })
        );
      }

      steps.push(
        createUploadArtifactBuildFunction(buildToolsContext).createBuildStepFromFunctionCall(
          globalCtx,
          {
            ifCondition: '${ always() }',
            name: 'Upload Maestro test results',
            callInputs: {
              path: '${ eas.env.HOME }/.maestro/',
              ignore_error: true,
              type: 'build-artifact',
            },
          }
        )
      );

      return steps;
    },
  });
}
