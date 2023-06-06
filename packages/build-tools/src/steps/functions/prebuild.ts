import { Job } from '@expo/eas-build-job';
import { BuildFunction, BuildStepInput } from '@expo/steps';

import { BuildContext } from '../../context';
import { prebuildAsync } from '../../common/prebuild';

export function createPrebuildBuildFunction<T extends Job>(ctx: BuildContext<T>): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'prebuild',
    name: 'Prebuild',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'apple_team_id',
        required: false,
      }),
    ],
    fn: async (stepsCtx, { inputs }) => {
      const extraEnvs: Record<string, string> = inputs.apple_team_id.value
        ? { APPLE_TEAM_ID: inputs.apple_team_id.value }
        : {};
      await prebuildAsync(ctx, {
        logger: stepsCtx.logger,
        workingDir: stepsCtx.workingDirectory,
        options: { extraEnvs },
      });
    },
  });
}
