import { Ios, Job } from '@expo/eas-build-job';
import { BuildFunction, BuildRuntimePlatform } from '@expo/steps';

import { BuildContext } from '../../context';
import { cleanUpIosCredentials } from '../../utils/credentials';

export function createCleanUpCredentialsBuildFunction<T extends Job>(
  ctx: BuildContext<T>
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'clean_up_ios_credentials',
    name: 'Clean up iOS credentials',
    supportedRuntimePlatforms: [BuildRuntimePlatform.DARWIN],
    fn: async (stepsCtx) => {
      await cleanUpIosCredentials(ctx as BuildContext<Ios.Job>, stepsCtx.logger);
    },
  });
}
