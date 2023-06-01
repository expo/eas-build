import { BuildFunction } from '@expo/steps';
import { Android, Ios, Job, Platform } from '@expo/eas-build-job';

import { BuildContext } from '../../context';
import { prepareAndroidCredentials, prepareIosCredentials } from '../../utils/credentials';

export function createPrepareCredentialsBuildFunction<T extends Job>(
  ctx: BuildContext<T>
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'prepare_credentials',
    name: 'Prepare credentials',
    fn: async (stepsCtx) => {
      if (ctx.job.platform === Platform.ANDROID) {
        const androidCredentials = await prepareAndroidCredentials(
          ctx as BuildContext<Android.Job>,
          stepsCtx.logger
        );
        stepsCtx.sharedEasContext.credentials = {
          ...stepsCtx.sharedEasContext.credentials,
          android: androidCredentials,
        };
      } else {
        const iosCredentials = await prepareIosCredentials(
          ctx as BuildContext<Ios.Job>,
          stepsCtx.logger
        );
        stepsCtx.sharedEasContext.credentials = {
          ...stepsCtx.sharedEasContext.credentials,
          ios: iosCredentials,
        };
      }
    },
  });
}
