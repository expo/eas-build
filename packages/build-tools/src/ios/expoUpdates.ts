import assert from 'assert';

import { IOSConfig } from '@expo/config-plugins';
import fs from 'fs-extra';
import plist from '@expo/plist';
import { Job } from '@expo/eas-build-job';

import { BuildContext } from '../context';

export enum IosMetadataName {
  UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY = 'EXUpdatesRequestHeaders',
  RELEASE_CHANNEL = 'EXUpdatesReleaseChannel',
  RUNTIME_VERSION = 'EXUpdatesRuntimeVersion',
}

export async function iosSetRuntimeVersionNativelyAsync(
  ctx: BuildContext<Job>,
  runtimeVersion: string
): Promise<void> {
  const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);

  if (!(await fs.pathExists(expoPlistPath))) {
    throw new Error(`${expoPlistPath} does not exist`);
  }

  const expoPlistContents = await fs.readFile(expoPlistPath, 'utf8');
  const items = plist.parse(expoPlistContents);
  items[IosMetadataName.RUNTIME_VERSION] = runtimeVersion;
  const updatedExpoPlistContents = plist.build(items);

  await fs.writeFile(expoPlistPath, updatedExpoPlistContents);
}

export async function iosSetChannelNativelyAsync(ctx: BuildContext<Job>): Promise<void> {
  assert(ctx.job.updates?.channel, 'updates.channel must be defined');

  const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);

  if (!(await fs.pathExists(expoPlistPath))) {
    throw new Error(`${expoPlistPath} does not exist`);
  }

  const expoPlistContents = await fs.readFile(expoPlistPath, 'utf8');
  const items: Record<string, string | Record<string, string>> = plist.parse(expoPlistContents);
  items[IosMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY] = {
    ...((items[IosMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY] as Record<
      string,
      string
    >) ?? {}),
    'expo-channel-name': ctx.job.updates.channel,
  };
  const updatedExpoPlistContents = plist.build(items);

  await fs.writeFile(expoPlistPath, updatedExpoPlistContents);
}

export async function iosSetClassicReleaseChannelNativelyAsync(
  ctx: BuildContext<Job>
): Promise<void> {
  assert(ctx.job.releaseChannel, 'releaseChannel must be defined');

  const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);

  if (!(await fs.pathExists(expoPlistPath))) {
    throw new Error(`${expoPlistPath} does not exist`);
  }

  const expoPlistContents = await fs.readFile(expoPlistPath, 'utf8');
  const items: Record<string, string | Record<string, string>> = plist.parse(expoPlistContents);
  items[IosMetadataName.RELEASE_CHANNEL] = ctx.job.releaseChannel;
  const updatedExpoPlistContents = plist.build(items);

  await fs.writeFile(expoPlistPath, updatedExpoPlistContents);
}

export async function iosGetNativelyDefinedClassicReleaseChannelAsync(
  ctx: BuildContext<Job>
): Promise<string | null> {
  const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);
  if (!(await fs.pathExists(expoPlistPath))) {
    return null;
  }
  const expoPlistContents = await fs.readFile(expoPlistPath, 'utf8');
  const parsedPlist = plist.parse(expoPlistContents);
  if (!parsedPlist) {
    return null;
  }
  return parsedPlist[IosMetadataName.RELEASE_CHANNEL] ?? null;
}

export async function iosGetNativelyDefinedRuntimeVersionAsync(
  ctx: BuildContext<Job>
): Promise<string | null> {
  const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);
  if (!(await fs.pathExists(expoPlistPath))) {
    return null;
  }
  const expoPlistContents = await fs.readFile(expoPlistPath, 'utf8');
  const parsedPlist = plist.parse(expoPlistContents);
  if (!parsedPlist) {
    return null;
  }
  return parsedPlist[IosMetadataName.RUNTIME_VERSION] ?? null;
}
