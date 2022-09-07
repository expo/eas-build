import path from 'path';

import fs from 'fs-extra';
import { Ios } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';

import { BuildContext } from '../context';

export async function installPods<TJob extends Ios.Job>(ctx: BuildContext<TJob>): Promise<void> {
  const iosDir = path.join(ctx.reactNativeProjectDirectory, 'ios');

  if (ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL) {
    ctx.logger.info('Running using experimental CocoaPods cache proxy...');
    const podfilePath = path.join(iosDir, 'Podfile');
    const originalPodfileContents = await fs.readFile(podfilePath, 'utf-8');

    const cocoaPodsCdnSourceRegex = /source( )+('|")https:\/\/cdn.cocoapods.org(\/)*('|")/;

    if (originalPodfileContents.search(cocoaPodsCdnSourceRegex) !== -1) {
      await fs.writeFile(
        podfilePath,
        originalPodfileContents.replace(
          cocoaPodsCdnSourceRegex,
          `source "${ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL}"`
        )
      );
    } else {
      await fs.writeFile(
        podfilePath,
        `source "${ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL}"\n${originalPodfileContents}`
      );
    }
  }

  await spawn('pod', ['install'], {
    cwd: iosDir,
    logger: ctx.logger,
    env: { ...ctx.env, LANG: 'en_US.UTF-8' },
  });
}
