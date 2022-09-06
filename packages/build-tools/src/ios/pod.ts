import path from 'path';

import fs from 'fs-extra';
import { Ios } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';

import { BuildContext } from '../context';

export async function installPods<TJob extends Ios.Job>(ctx: BuildContext<TJob>): Promise<void> {
  const iosDir = path.join(ctx.reactNativeProjectDirectory, 'ios');

  if (ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL) {
    ctx.logger.info('Running using experimental CocoaPods cache proxy...');
    const podFilePath = path.join(iosDir, 'Podfile');
    const originalPodFileContentBuffer = await fs.readFile(podFilePath);
    const originalPodFileContent = originalPodFileContentBuffer.toString('utf-8');

    if (
      originalPodFileContent.search(/source( )+('|")https:\/\/cdn.cocoapods.org(\/)*('|")/) !== -1
    ) {
      ctx.logger.info('Replacing CocoaPods CDN source with proxy...');
      await fs.writeFile(
        podFilePath,
        originalPodFileContent.replace(
          /source( )+('|")https:\/\/cdn.cocoapods.org(\/)*('|")/,
          `source "${ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL}"`
        )
      );
    } else {
      ctx.logger.info('Adding proxy as a source...');
      await fs.writeFile(
        podFilePath,
        `source "${ctx.env.EAS_BUILD_COCOAPODS_CACHE_URL}"\n${originalPodFileContent}`
      );
    }
  }

  ctx.logger.info('Installing pods');
  await spawn('pod', ['install'], {
    cwd: iosDir,
    logger: ctx.logger,
    env: { ...ctx.env, LANG: 'en_US.UTF-8' },
  });
}
