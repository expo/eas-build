import assert from 'assert';

import { Ios, Android, Platform, Job } from '@expo/eas-build-job';

import {
  androidSetChannelNativelyAsync,
  androidSetClassicReleaseChannelNativelyAsync,
  androidGetNativelyDefinedReleaseChannelAsync,
} from '../android/expoUpdates';
import {
  iosSetChannelNativelyAsync,
  iosSetReleaseChannelNativelyAsync,
  iosGetNativelyDefinedReleaseChannelAsync,
} from '../ios/expoUpdates';
import { BuildContext } from '../context';

import isExpoUpdatesInstalledAsync from './isExpoUpdatesInstalled';
export type GenericJob = Ios.GenericJob | Android.GenericJob;

/**
 * Used for when Expo Updates is pointed at an EAS server.
 * @param ctx
 * @param platform
 */
export const setChannelNativelyAsync = async (ctx: BuildContext<Job>): Promise<void> => {
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

  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      await androidSetChannelNativelyAsync(ctx);
      return;
    }
    case Platform.IOS: {
      await iosSetChannelNativelyAsync(ctx);
      return;
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
};

/**
 * Used for classic Expo Updates
 * @param ctx
 * @param platform
 */
export const setReleaseChannelNativelyAsync = async (ctx: BuildContext<Job>): Promise<void> => {
  assert(ctx.job.releaseChannel, 'releaseChannel must be defined');

  const configFile = ctx.job.platform === Platform.ANDROID ? 'AndroidManifest.xml' : 'Expo.plist';
  ctx.logger.info(`Setting the release channel in '${configFile}' to '${ctx.job.releaseChannel}'`);

  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      await androidSetClassicReleaseChannelNativelyAsync(ctx);
      return;
    }
    case Platform.IOS: {
      await iosSetReleaseChannelNativelyAsync(ctx);
      return;
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
};

/**
 * Used for classic Expo Updates
 * @param ctx
 * @param platform
 */
export const getNativelyDefinedReleaseChannelAsync = async (
  ctx: BuildContext<Job>
): Promise<string | null> => {
  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      return androidGetNativelyDefinedReleaseChannelAsync(ctx);
    }
    case Platform.IOS: {
      return iosGetNativelyDefinedReleaseChannelAsync(ctx);
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
};

export const configureClassicExpoUpdatesAsync = async (ctx: BuildContext<Job>): Promise<void> => {
  if (ctx.job.releaseChannel) {
    await setReleaseChannelNativelyAsync(ctx);
  } else {
    /**
     * If releaseChannel is not defined:
     *  1. Try to infer it from the native value.
     *  2. If it is not set, fallback to 'default'.
     */
    try {
      const releaseChannel = await getNativelyDefinedReleaseChannelAsync(ctx);
      assert(releaseChannel, 'release channel is not defined natively');
      ctx.logger.info(
        `Using the release channel pre-configured in native project (${releaseChannel})`
      );
      ctx.logger.warn('Please add the "releaseChannel" field to your build profile (eas.json)');
    } catch (_) {
      ctx.logger.info(`Using default release channel for 'expo-updates' (default)`);
    }
  }
};

export const configureEASExpoUpdatesAsync = async (ctx: BuildContext<Job>): Promise<void> => {
  await setChannelNativelyAsync(ctx);
};

export const configureExpoUpdatesIfInstalledAsync = async (
  ctx: BuildContext<Job>
): Promise<void> => {
  if (!(await isExpoUpdatesInstalledAsync(ctx.reactNativeProjectDirectory))) {
    return;
  }

  if (ctx.job.updates?.channel) {
    await configureEASExpoUpdatesAsync(ctx);
  } else {
    await configureClassicExpoUpdatesAsync(ctx);
  }
};
