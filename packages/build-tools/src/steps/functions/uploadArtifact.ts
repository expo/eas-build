import path from 'path';

import { GenericArtifactType, ManagedArtifactType } from '@expo/eas-build-job';
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
          ...Object.values(GenericArtifactType),
        ],
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'key',
        defaultValue: '',
        required: false,
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

      const artifact = {
        type: inputs.type.value as ManagedArtifactType | GenericArtifactType,
        paths: [filePath],
        key: inputs.key.value as string,
      };

      await ctx.runtimeApi.uploadArtifact({
        artifact,
        logger: stepsCtx.logger,
      });
    },
  });
}
