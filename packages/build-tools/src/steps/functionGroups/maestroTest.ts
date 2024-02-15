import {
  BuildFunctionGroup,
  BuildStep,
  BuildStepInput,
  BuildStepInputValueTypeName,
} from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { CustomBuildContext } from '../../customBuildContext';
import { createInstallMaestroBuildFunction } from '../functions/installMaestro';
import { createStartIosSimulatorBuildFunction } from '../functions/startIosSimulator';
import { createStartAndroidEmulatorBuildFunction } from '../functions/startAndroidEmulator';

export function createEasMaestroTestFunctionGroup(
  buildToolsContext: CustomBuildContext
): BuildFunctionGroup {
  return new BuildFunctionGroup({
    namespace: 'eas',
    id: 'maestro_test',
    inputProviders: [
      BuildStepInput.createProvider({
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        id: 'flow_file_path',
        required: false,
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
      } else if (buildToolsContext.job.platform === Platform.ANDROID) {
        steps.push(
          createStartAndroidEmulatorBuildFunction().createBuildStepFromFunctionCall(globalCtx)
        );
      }

      const flowFilePath = inputs.flow_file_path.value;
      if (flowFilePath) {
        steps.push(
          new BuildStep(globalCtx, {
            id: BuildStep.getNewId(),
            name: 'maestro_test',
            displayName: 'Run "maestro test"',
            command: `maestro test ${inputs.flow_path.value}`,
          })
        );
      } else {
        steps.push(
          new BuildStep(globalCtx, {
            id: BuildStep.getNewId(),
            name: 'maestro_test',
            displayName: 'Run "maestro test"',
            ifCondition: '${ never() }',
            fn: (ctx) => {
              ctx.logger.warn('flow_file_path not provided. Skipping running test.');
            },
          })
        );
      }

      return steps;
    },
  });
}
