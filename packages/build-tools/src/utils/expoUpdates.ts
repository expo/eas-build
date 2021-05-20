import assert from 'assert';

import { Ios, Android, Platform } from '@expo/eas-build-job';

import {
  androidSetChannelNativelyAsync,
  androidSetReleaseChannelNativelyAsync,
  androidGetNativelyDefinedReleaseChannelAsync,
} from '../android/expoUpdates';
import {
  iosSetChannelNativelyAsync,
  iosSetReleaseChannelNativelyAsync,
  iosGetNativelyDefinedReleaseChannelAsync,
} from '../ios/expoUpdates';
import { BuildContext } from '../context';
import { ManagedBuildContext, ManagedJob } from '../managed/context';

import isExpoUpdatesInstalledAsync from './isExpoUpdatesInstalled';
export type GenericJob = Ios.GenericJob | Android.GenericJob;

/**
 * Used for when Expo Updates is pointed at an EAS server.
 * @param ctx
 * @param platform
 */
export const setChannelNativelyAsync = async (
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>,
  platform: Platform
): Promise<void> => {
  assert(ctx.job.updates?.channel, 'updates.channel must be defined');
  const newUpdateRequestHeaders: Record<string, string> = {
    'expo-channel-name': ctx.job.updates.channel,
  };

  const configFile = ctx.job.platform === Platform.ANDROID ? 'AndroidManifest.xml' : 'Expo.plist';
  ctx.logger.info(
    `Setting the update response headers in '${configFile}' to '${JSON.stringify(
      newUpdateRequestHeaders
    )}'`
  );

  switch (platform) {
    case Platform.ANDROID: {
      await androidSetChannelNativelyAsync(ctx);
      return;
    }
    case Platform.IOS: {
      await iosSetChannelNativelyAsync(ctx);
      return;
    }
    default:
      throw new Error(`Platform ${platform} is not supported.`);
  }
};

/**
 * Used for classic Expo Updates
 * @param ctx
 * @param platform
 */
export const setReleaseChannelNativelyAsync = async (
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>,
  platform: Platform
): Promise<void> => {
  assert(ctx.job.releaseChannel, 'releaseChannel must be defined');

  const configFile = ctx.job.platform === Platform.ANDROID ? 'AndroidManifest.xml' : 'Expo.plist';
  ctx.logger.info(`Setting the release channel in '${configFile}' to '${ctx.job.releaseChannel}'`);

  switch (platform) {
    case Platform.ANDROID: {
      await androidSetReleaseChannelNativelyAsync(ctx);
      return;
    }
    case Platform.IOS: {
      await iosSetReleaseChannelNativelyAsync(ctx);
      return;
    }
    default:
      throw new Error(`Platform ${platform} is not supported.`);
  }
};

/**
 * Used for classic Expo Updates
 * @param ctx
 * @param platform
 */
export const getNativelyDefinedReleaseChannelAsync = async (
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>,
  platform: Platform
): Promise<string | undefined | null> => {
  switch (platform) {
    case Platform.ANDROID: {
      return androidGetNativelyDefinedReleaseChannelAsync(ctx);
    }
    case Platform.IOS: {
      return iosGetNativelyDefinedReleaseChannelAsync(ctx);
    }
    default:
      throw new Error(`Platform ${platform} is not supported.`);
  }
};

export const configureClassicExpoUpdatesAsync = async (
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>,
  platform: Platform
): Promise<void> => {
  if (ctx.job.releaseChannel) {
    await setReleaseChannelNativelyAsync(ctx, platform);
  } else {
    /**
     * If releaseChannel is not defined:
     *  1. Try to infer it from the native value.
     *  2. If it is not set, fallback to 'default'.
     */
    try {
      const releaseChannel = await getNativelyDefinedReleaseChannelAsync(ctx, platform);
      ctx.logger.info(
        `Using the release channel pre-configured in native project (${releaseChannel})`
      );
      ctx.logger.warn('Please add the "releaseChannel" field to your build profile (eas.json)');
    } catch (_) {
      // only difference between generic and managed is that managed doesn't even try to look for the release channel in native code.
      // if (ctx instanceof ManagedBuildContext) {
      //   return undefined;
      // }

      ctx.logger.info(`Using default release channel for 'expo-updates' (default)`);
    }
  }
};

export const configureEASExpoUpdatesAsync = async (
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>,
  platform: Platform
): Promise<void> => {
  await setChannelNativelyAsync(ctx, platform);
};

export const configureExpoUpdatesIfInstalledAsync = async (
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>,
  platform: Platform
): Promise<void> => {
  if (!(await isExpoUpdatesInstalledAsync(ctx.reactNativeProjectDirectory))) {
    return;
  }

  switch (true) {
    case !!ctx.job.updates?.channel: {
      await configureEASExpoUpdatesAsync(ctx, platform);
      return;
    }
    default: {
      await configureClassicExpoUpdatesAsync(ctx, platform);
    }
  }
};
