import { BuildFunction, BuildRuntimePlatform } from '@expo/steps';

import { cleanUpIosCredentials } from '../../utils/credentials';

export function createCleanUpCredentialsBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'clean_up_ios_credentials',
    name: 'Clean up iOS credentials',
    supportedRuntimePlatforms: [BuildRuntimePlatform.DARWIN],
    fn: async (stepsCtx) => {
      await cleanUpIosCredentials(stepsCtx.logger);
    },
  });
}
