import path from 'path';

import { Ios } from '@expo/eas-build-job';
import { spawnAsync } from '@expo/steps';

import { BuildContext } from '../context';

export async function installPods<TJob extends Ios.Job>(ctx: BuildContext<TJob>): Promise<void> {
  const iosDir = path.join(ctx.getReactNativeProjectDirectory(), 'ios');

  await spawnAsync('pod', ['install'], {
    cwd: iosDir,
    logger: ctx.logger,
    stdio: 'pipe',
    env: {
      ...ctx.env,
      LANG: 'en_US.UTF-8',
      ...(ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL
        ? { NEXUS_COCOAPODS_REPO_URL: ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL }
        : {}),
    },
    lineTransformer: (line?: string) => {
      if (
        !line ||
        /\[!\] '[\w-]+' uses the unencrypted 'http' protocol to transfer the Pod\./.exec(line)
      ) {
        return null;
      } else {
        return line;
      }
    },
  });
}
