import { BuildFunction } from '@expo/steps';
import { Job, Platform } from '@expo/eas-build-job';

import { cleanUpIosCredentials } from '../../utils/credentials';
import { BuildContext } from '../../context';

export function createCleanUpCredentialsBuildFunction<T extends Job>(
  ctx: BuildContext<T>
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'clean_up_credentials',
    name: 'Clean up credentials',
    fn: async (stepsCtx) => {
      if (ctx.job.platform === Platform.IOS) {
        await cleanUpIosCredentials(stepsCtx.logger);
      }
      stepsCtx.sharedEasContext.credentials = {
        android: undefined,
        ios: undefined,
      };
    },
  });
}
