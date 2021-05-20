import assert from 'assert';
import path from 'path';

import fs from 'fs-extra';
import { Ios, Android, Platform } from '@expo/eas-build-job';
import { AndroidConfig } from '@expo/config-plugins';
import plist from '@expo/plist';

import { AndroidMetadataName } from '../android/expoUpdates';
import { BuildContext } from '../context';
import { getExpoPlistDirectoryAsync, IosMetadataName } from '../ios/expoUpdates';
import { ManagedBuildContext, ManagedJob } from '../managed/context';

import isExpoUpdatesInstalledAsync from './isExpoUpdatesInstalled';
export type GenericJob = Ios.GenericJob | Android.GenericJob;

/**
 * Used for when Expo Updates is pointed at an EAS server.
 * @param ctx
 * @param platform
 */
export async function setChannelNativelyAsync(
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>,
  platform: Platform
): Promise<void> {
  assert(ctx.job.updates?.channel, 'updates.channel must be defined');
  // TODO combine with pre-existing updateRequestHeaders
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
      const manifestPath = path.join(
        getAndroidManifestDirectory(ctx.reactNativeProjectDirectory),
        'AndroidManifest.xml'
      );
      if (!(await fs.pathExists(manifestPath))) {
        throw new Error(`Couldn't find Android manifest at ${manifestPath}`);
      }

      const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
      const mainApp = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
      const stringifiedUpdatesRequestHeaders = AndroidConfig.Manifest.getMainApplicationMetaDataValue(
        androidManifest,
        AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY
      );
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApp,
        AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY,
        JSON.stringify({
          ...JSON.parse(stringifiedUpdatesRequestHeaders ?? '{}'),
          'expo-channel-name': ctx.job.updates.channel,
        }),
        'value'
      );
      await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, androidManifest);
      return;
    }
    case Platform.IOS: {
      const expoPlistPath = path.resolve(
        await getExpoPlistDirectoryAsync(ctx.reactNativeProjectDirectory),
        'Expo.plist'
      );

      let items: Record<string, string | Record<string, string>> = {};
      if (!(await fs.pathExists(expoPlistPath))) {
        throw new Error(`${expoPlistPath} does no exist`);
      }

      const expoPlistContent = await fs.readFile(expoPlistPath, 'utf8');
      items = plist.parse(expoPlistContent);
      items[IosMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY] = {
        ...((items[IosMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY] as Record<
          string,
          string
        >) ?? {}),
        'expo-channel-name': ctx.job.updates.channel,
      };
      const expoPlist = plist.build(items);

      await fs.writeFile(expoPlistPath, expoPlist);
      return;
    }
    default:
      throw new Error(`Platform ${platform} is not supported.`);
  }
}

export function getAndroidManifestDirectory(reactNativeProjectDirectory: string): string {
  return path.join(reactNativeProjectDirectory, 'android', 'app', 'src', 'main');
}

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
      const manifestPath = path.join(
        getAndroidManifestDirectory(ctx.reactNativeProjectDirectory),
        'AndroidManifest.xml'
      );
      if (!(await fs.pathExists(manifestPath))) {
        throw new Error(`Couldn't find Android manifest at ${manifestPath}`);
      }

      const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
      const mainApp = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApp,
        AndroidMetadataName.RELEASE_CHANNEL,
        ctx.job.releaseChannel,
        'value'
      );
      await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, androidManifest);
      return;
    }
    case Platform.IOS: {
      const expoPlistPath = path.resolve(
        await getExpoPlistDirectoryAsync(ctx.reactNativeProjectDirectory),
        'Expo.plist'
      );

      let items: Record<string, string | Record<string, string>> = {};
      if (!(await fs.pathExists(expoPlistPath))) {
        throw new Error(`${expoPlistPath} does no exist`);
      }

      const expoPlistContent = await fs.readFile(expoPlistPath, 'utf8');
      items = plist.parse(expoPlistContent);
      items[IosMetadataName.RELEASE_CHANNEL] = ctx.job.releaseChannel;
      const expoPlist = plist.build(items);

      await fs.writeFile(expoPlistPath, expoPlist);
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
      const manifestPath = path.join(
        getAndroidManifestDirectory(ctx.reactNativeProjectDirectory),
        'AndroidManifest.xml'
      );
      if (!(await fs.pathExists(manifestPath))) {
        return;
      }

      const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
      return AndroidConfig.Manifest.getMainApplicationMetaDataValue(
        androidManifest,
        AndroidMetadataName.RELEASE_CHANNEL
      );
    }
    case Platform.IOS: {
      const expoPlistPath = path.resolve(
        await getExpoPlistDirectoryAsync(ctx.reactNativeProjectDirectory),
        'Expo.plist'
      );
      if (!(await fs.pathExists(expoPlistPath))) {
        return;
      }
      const expoPlistContent = await fs.readFile(expoPlistPath, 'utf8');
      const parsedPlist = plist.parse(expoPlistContent);
      if (!parsedPlist) {
        return;
      }
      return parsedPlist[IosMetadataName.RELEASE_CHANNEL];
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

export async function configureExpoUpdatesIfInstalledAsync(
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>,
  platform: Platform
): Promise<void> {
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
}
