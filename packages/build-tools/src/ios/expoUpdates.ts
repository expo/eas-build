import path from 'path';
import assert from 'assert';

import fs from 'fs-extra';
import plist from '@expo/plist';
import fg from 'fast-glob';
import { Job } from '@expo/eas-build-job';

import { BuildContext } from '../context';

export enum IosMetadataName {
  UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY = 'EXUpdatesRequestHeaders',
  RELEASE_CHANNEL = 'EXUpdatesReleaseChannel',
}

export async function getExpoPlistDirectoryAsync(
  reactNativeProjectDirectory: string
): Promise<string> {
  const pbxprojPaths = await fg('ios/*/project.pbxproj', { cwd: reactNativeProjectDirectory });
  const pbxprojPath = pbxprojPaths.length > 0 ? pbxprojPaths[0] : undefined;
  if (!pbxprojPath) {
    throw new Error(`Couldn't find an iOS project at '${reactNativeProjectDirectory}'`);
  }
  const xcodeprojPath = path.resolve(pbxprojPath, '..');
  return path.resolve(
    reactNativeProjectDirectory,
    'ios',
    path.basename(xcodeprojPath).replace(/\.xcodeproj$/, ''),
    'Supporting'
  );
}

export async function iosSetChannelNativelyAsync(ctx: BuildContext<Job>): Promise<void> {
  assert(ctx.job.updates?.channel, 'updates.channel must be defined');

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
}

export const iosSetReleaseChannelNativelyAsync = async (ctx: BuildContext<Job>): Promise<void> => {
  assert(ctx.job.releaseChannel, 'releaseChannel must be defined');

  const expoPlistPath = path.resolve(
    await getExpoPlistDirectoryAsync(ctx.reactNativeProjectDirectory),
    'Expo.plist'
  );

  let items: Record<string, string | Record<string, string>> = {};
  if (!(await fs.pathExists(expoPlistPath))) {
    throw new Error(`${expoPlistPath} does not exist`);
  }

  const expoPlistContent = await fs.readFile(expoPlistPath, 'utf8');
  items = plist.parse(expoPlistContent);
  items[IosMetadataName.RELEASE_CHANNEL] = ctx.job.releaseChannel;
  const expoPlist = plist.build(items);

  await fs.writeFile(expoPlistPath, expoPlist);
};

export const iosGetNativelyDefinedReleaseChannelAsync = async (
  ctx: BuildContext<Job>
): Promise<string | undefined | null> => {
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
};
