import { Ios, Android, Platform } from '@expo/eas-build-job';

import { BuildContext } from '../context';
import isExpoUpdatesInstalledAsync from '../utils/isExpoUpdatesInstalled';

type GenericJob = Ios.GenericJob | Android.GenericJob;

export async function configureExpoUpdatesIfInstalled<TJob extends GenericJob>(
  ctx: BuildContext<TJob>,
  {
    getReleaseChannel,
    updateReleaseChannel,
  }: {
    getReleaseChannel: (dir: string) => Promise<string | undefined>;
    updateReleaseChannel: (dir: string, releaseChannel: string) => Promise<void>;
  }
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
      const channel = await getReleaseChannel(ctx.reactNativeProjectDirectory);
      if (!channel || channel === 'default') {
        ctx.logger.info(`Using default release channel for 'expo-updates' (default)`);
      } else {
        ctx.logger.info(`Using the release channel pre-configured in native project (${channel})`);
        ctx.logger.warn('Please add the "releaseChannel" field to your build profile (eas.json)');
      }
    }
  }
}
