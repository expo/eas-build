import assert from 'assert';

import fs from 'fs-extra';
import { AndroidConfig } from '@expo/config-plugins';
import { Job } from '@expo/eas-build-job';

import { BuildContext } from '../context';

export enum AndroidMetadataName {
  UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY = 'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',
  RELEASE_CHANNEL = 'expo.modules.updates.EXPO_RELEASE_CHANNEL',
  RUNTIME_VERSION = 'expo.modules.updates.EXPO_RUNTIME_VERSION',
}

export async function androidSetChannelNativelyAsync(ctx: BuildContext<Job>): Promise<void> {
  assert(ctx.job.updates?.channel, 'updates.channel must be defined');

  const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
    ctx.reactNativeProjectDirectory
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

  // apkanalyzer unescapes double quotes before parsing. This leads to crashes.
  // Luckily, we can replace the double quotes with single quotes and it will
  // still be parsed as a JSON by the expo-updates client
  const singleQuotedStringifiedUpdatesRequestHeaders = JSON.stringify({
    ...JSON.parse(stringifiedUpdatesRequestHeaders ?? '{}'),
    'expo-channel-name': ctx.job.updates.channel,
  }).replace(/"/g, "'");

  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    mainApp,
    AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY,
    singleQuotedStringifiedUpdatesRequestHeaders,
    'value'
  );
  await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, androidManifest);
}

export async function androidSetClassicReleaseChannelNativelyAsync(
  ctx: BuildContext<Job>
): Promise<void> {
  assert(ctx.job.releaseChannel, 'releaseChannel must be defined');

  const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
    ctx.reactNativeProjectDirectory
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
}

export async function androidGetNativelyDefinedClassicReleaseChannelAsync(
  ctx: BuildContext<Job>
): Promise<string | null> {
  const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
    ctx.reactNativeProjectDirectory
  );
  if (!(await fs.pathExists(manifestPath))) {
    return null;
  }

  const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  return AndroidConfig.Manifest.getMainApplicationMetaDataValue(
    androidManifest,
    AndroidMetadataName.RELEASE_CHANNEL
  );
}

export async function androidGetNativelyDefinedRuntimeVersionAsync(
  ctx: BuildContext<Job>
): Promise<string | null> {
  const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
    ctx.reactNativeProjectDirectory
  );
  if (!(await fs.pathExists(manifestPath))) {
    return null;
  }

  const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  return AndroidConfig.Manifest.getMainApplicationMetaDataValue(
    androidManifest,
    AndroidMetadataName.RUNTIME_VERSION
  );
}
