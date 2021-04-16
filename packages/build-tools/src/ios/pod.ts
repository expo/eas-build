import path from 'path';

import { Ios } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';

import { BuildContext } from '../context';

export async function installPods<TJob extends Ios.Job>(ctx: BuildContext<TJob>): Promise<void> {
  const iosDir = path.join(ctx.reactNativeProjectDirectory, 'ios');
  ctx.logger.info('Installing pods');
  await spawn('pod', ['install'], {
    cwd: iosDir,
    logger: ctx.logger,
    env: { ...ctx.env, LANG: 'en_US.UTF-8' },
  });
}
