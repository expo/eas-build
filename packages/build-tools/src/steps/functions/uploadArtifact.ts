import path from 'path';

import { ManagedArtifactType } from '@expo/eas-build-job';
import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import nullthrows from 'nullthrows';

import { CustomBuildContext } from '../../customBuildContext';

export function createUploadArtifactBuildFunction(ctx: CustomBuildContext): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'upload_artifact',
    name: 'Upload artifact',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'type',
        defaultValue: ManagedArtifactType.APPLICATION_ARCHIVE,
        allowedValues: [
          ManagedArtifactType.APPLICATION_ARCHIVE,
          ManagedArtifactType.BUILD_ARTIFACTS,
        ],
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'path',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async (stepsCtx, { inputs }) => {
      const filePath = path.resolve(
        stepsCtx.workingDirectory,
        nullthrows(inputs.path.value).toString()
      );
      const artifactType = inputs.type.value as ManagedArtifactType;

      await ctx.runtimeApi.uploadArtifact({
        artifact: {
          type: artifactType,
          paths: [filePath],
        },
        logger: stepsCtx.logger,
      });
    },
  });
}
