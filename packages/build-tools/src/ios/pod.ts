import path from 'path';

import { Ios } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';

import { BuildContext } from '../context';

export async function installPods<TJob extends Ios.Job>(ctx: BuildContext<TJob>): Promise<void> {
  const iosDir = path.join(ctx.reactNativeProjectDirectory, 'ios');

  await spawn('pod', ['install'], {
    cwd: iosDir,
    logger: ctx.logger,
    env: {
      ...ctx.env,
      LANG: 'en_US.UTF-8',
      ...(ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL
        ? { COCCOAPODS_CACHE_URL: ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL }
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
