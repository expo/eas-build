import path from 'path';

import fs from 'fs-extra';
import { Ios } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';

import { BuildContext } from '../context';

export async function installPods<TJob extends Ios.Job>(ctx: BuildContext<TJob>): Promise<void> {
  const iosDir = path.join(ctx.reactNativeProjectDirectory, 'ios');

  if (ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL && Math.random() < 0.33) {
    ctx.logger.info('Running using experimental Cocoapods cache proxy...');
    const podFile = path.join(iosDir, 'Podfile');
    await fs.appendFile(podFile, `\nsource "${ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL}"`);
  }

  ctx.logger.info('Installing pods');
  await spawn('pod', ['install'], {
    cwd: iosDir,
    logger: ctx.logger,
    env: { ...ctx.env, LANG: 'en_US.UTF-8' },
  });
}
