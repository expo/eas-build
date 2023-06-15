import { Job } from '@expo/eas-build-job';
import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';

import { BuildContext } from '../../../context';
import { prebuildAsync } from '../../../common/prebuild';

export function createPrebuildBuildFunction<T extends Job>(ctx: BuildContext<T>): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'prebuild',
    name: 'Prebuild',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'skip_dependency_update',
        defaultValue: false,
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
      }),
      BuildStepInput.createProvider({
        id: 'clean',
        defaultValue: false,
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
      }),
      BuildStepInput.createProvider({
        id: 'apple_team_id',
        required: false,
      }),
    ],
    fn: async (stepsCtx, { inputs }) => {
      // TODO: make sure we can pass Apple Team ID to prebuild when adding credentials for custom builds
      const extraEnvs: Record<string, string> = inputs.apple_team_id.value
        ? { APPLE_TEAM_ID: inputs.apple_team_id.value.toString() }
        : {};
      await prebuildAsync(ctx, {
        logger: stepsCtx.logger,
        workingDir: stepsCtx.workingDirectory,
        options: {
          extraEnvs,
          clean: !!inputs.clean.value,
          skipDependencyUpdate: inputs.skip_dependency_update.value?.toString(),
        },
      });
    },
  });
}
