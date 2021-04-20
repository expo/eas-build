import { Platform } from '@expo/eas-build-job';

import isExpoUpdatesInstalledAsync from '../utils/isExpoUpdatesInstalled';

import { ManagedBuildContext, ManagedJob } from './context';

export async function configureExpoUpdatesIfInstalled<TJob extends ManagedJob>(
  ctx: ManagedBuildContext<TJob>,
  updateReleaseChannel: (dir: string, releaseChannel: string) => Promise<void>
): Promise<void> {
  if (await isExpoUpdatesInstalledAsync(ctx.reactNativeProjectDirectory)) {
    if (ctx.job.releaseChannel) {
      const configFile =
        ctx.job.platform === Platform.ANDROID ? 'AndroidManifest.xml' : 'Expo.plist';
      ctx.logger.info(
        `Setting the release channel in '${configFile}' to '${ctx.job.releaseChannel}'`
      );
      await updateReleaseChannel(ctx.reactNativeProjectDirectory, ctx.job.releaseChannel);
    } else {
      ctx.logger.info(`Using default release channel for 'expo-updates' (default)`);
    }
  }
}
