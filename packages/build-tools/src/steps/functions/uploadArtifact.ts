import path from 'path';

import { GenericArtifactType, ManagedArtifactType } from '@expo/eas-build-job';
import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import nullthrows from 'nullthrows';

import { CustomBuildContext } from '../../customBuildContext';

const artifactTypeInputToManagedArtifactType: Record<string, ManagedArtifactType | undefined> = {
  'application-archive': ManagedArtifactType.APPLICATION_ARCHIVE,
  'build-artifact': ManagedArtifactType.BUILD_ARTIFACTS,
};

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
          ...Object.keys(artifactTypeInputToManagedArtifactType),
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
        type: parseArtifactTypeInput(`${inputs.type.value}`),
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

/**
 * Initially, upload_artifact supported application-archive and build-artifact.
 * Then, mistakenly, support for it was removed in favor of supporting ManagedArtifactType
 * values. This makes sure we support all:
 * - kebab-case managed artifact types (the original)
 * - snake-caps-case managed artifact types (the mistake)
 * - generic artifact types.
 */
function parseArtifactTypeInput(input: string): GenericArtifactType | ManagedArtifactType {
  // Step's allowedValues ensures input is either
  // a key of artifactTypeInputToManagedArtifactType
  // or a value of an artifact type.
  const translatedManagedArtifactType = artifactTypeInputToManagedArtifactType[input];
  if (translatedManagedArtifactType) {
    return translatedManagedArtifactType;
  }

  return input as GenericArtifactType | ManagedArtifactType;
}
