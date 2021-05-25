import assert from 'assert';

import { IOSConfig } from '@expo/config-plugins';
import fs from 'fs-extra';
import plist from '@expo/plist';
import { Job } from '@expo/eas-build-job';

import { BuildContext } from '../context';

export enum IosMetadataName {
  UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY = 'EXUpdatesRequestHeaders',
  RELEASE_CHANNEL = 'EXUpdatesReleaseChannel',
}

export async function iosSetChannelNativelyAsync(ctx: BuildContext<Job>): Promise<void> {
  assert(ctx.job.updates?.channel, 'updates.channel must be defined');

  const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);

  if (!(await fs.pathExists(expoPlistPath))) {
    throw new Error(`${expoPlistPath} does no exist`);
  }

  const expoPlistContent = await fs.readFile(expoPlistPath, 'utf8');
  const items: Record<string, string | Record<string, string>> = plist.parse(expoPlistContent);
  items[IosMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY] = {
    ...((items[IosMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY] as Record<
      string,
      string
    >) ?? {}),
    'expo-channel-name': ctx.job.updates.channel,
  };
  const expoPlist = plist.build(items);

  await fs.writeFile(expoPlistPath, expoPlist);
}

export async function iosSetReleaseChannelNativelyAsync(ctx: BuildContext<Job>): Promise<void> {
  assert(ctx.job.releaseChannel, 'releaseChannel must be defined');

  const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);

  if (!(await fs.pathExists(expoPlistPath))) {
    throw new Error(`${expoPlistPath} does not exist`);
  }

  const expoPlistContent = await fs.readFile(expoPlistPath, 'utf8');
  const items: Record<string, string | Record<string, string>> = plist.parse(expoPlistContent);
  items[IosMetadataName.RELEASE_CHANNEL] = ctx.job.releaseChannel;
  const expoPlist = plist.build(items);

  await fs.writeFile(expoPlistPath, expoPlist);
}

export async function iosGetNativelyDefinedReleaseChannelAsync(
  ctx: BuildContext<Job>
): Promise<string | undefined | null> {
  const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);
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
