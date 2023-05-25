import { Job } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { BuildContext } from '../../context';
import { setUpNpmrcAsync } from '../../utils/npmrc';

export function createSetUpNpmrcBuildFunction<T extends Job>(ctx: BuildContext<T>): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'use_npm_token',
    name: 'Use NPM_TOKEN',
    fn: async (stepsCtx) => {
      await setUpNpmrcAsync(ctx, stepsCtx.logger);
    },
  });
}
