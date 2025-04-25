import path from 'path';

import { Ios } from '@expo/eas-build-job';
import spawn, { SpawnOptions, SpawnPromise, SpawnResult } from '@expo/turtle-spawn';

import { BuildContext } from '../context';

export async function installPods<TJob extends Ios.Job>(
  ctx: BuildContext<TJob>,
  { infoCallbackFn }: SpawnOptions
): Promise<{ spawnPromise: SpawnPromise<SpawnResult> }> {
  const iosDir = path.join(ctx.getReactNativeProjectDirectory(), 'ios');

  const verboseFlag = ctx.env['EAS_VERBOSE'] === '1' ? ['--verbose'] : [];

  return {
    spawnPromise: spawn('pod', ['install', ...verboseFlag], {
      cwd: iosDir,
      logger: ctx.logger,
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
      infoCallbackFn,
    }),
  };
}
