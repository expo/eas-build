import path from 'path';
import assert from 'assert';

import fs from 'fs-extra';
import { AndroidConfig } from '@expo/config-plugins';

import { ManagedBuildContext, ManagedJob } from '../managed/context';
import { BuildContext } from '../context';
import { GenericJob } from '../utils/expoUpdates';
export enum AndroidMetadataName {
  UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY = 'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',
  RELEASE_CHANNEL = 'expo.modules.updates.EXPO_RELEASE_CHANNEL',
}
export function getAndroidManifestDirectory(reactNativeProjectDirectory: string): string {
  return path.join(reactNativeProjectDirectory, 'android', 'app', 'src', 'main');
}

export async function androidSetChannelNativelyAsync(
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>
): Promise<void> {
  assert(ctx.job.updates?.channel, 'updates.channel must be defined');

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
}

export const androidSetReleaseChannelNativelyAsync = async (
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>
): Promise<void> => {
  assert(ctx.job.releaseChannel, 'releaseChannel must be defined');

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
};

export const androidGetNativelyDefinedReleaseChannelAsync = async (
  ctx: ManagedBuildContext<ManagedJob> | BuildContext<GenericJob>
): Promise<string | undefined | null> => {
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
};
