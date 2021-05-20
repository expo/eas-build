import path from 'path';

import plist from '@expo/plist';
import fg from 'fast-glob';
import fs from 'fs-extra';

export enum IosMetadataName {
  UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY = 'expo.modules.updates.EXUpdatesRequestHeaders',
  RELEASE_CHANNEL = 'expo.modules.updates.EXPO_RELEASE_CHANNEL',
}
async function setIosMetadataEntryAsync({
  reactNativeProjectDirectory,
  iosMetadataValue,
  iosMetadataName,
}: {
  reactNativeProjectDirectory: string;
  iosMetadataValue: string | Record<string, string>;
  iosMetadataName: IosMetadataName;
}): Promise<void> {
  const pbxprojPaths = await fg('ios/*/project.pbxproj', { cwd: reactNativeProjectDirectory });

  const pbxprojPath = pbxprojPaths.length > 0 ? pbxprojPaths[0] : undefined;

  if (!pbxprojPath) {
    throw new Error(`Couldn't find an iOS project at '${reactNativeProjectDirectory}'`);
  }

  const xcodeprojPath = path.resolve(pbxprojPath, '..');
  const expoPlistPath = path.resolve(
    reactNativeProjectDirectory,
    'ios',
    path.basename(xcodeprojPath).replace(/\.xcodeproj$/, ''),
    'Supporting',
    'Expo.plist'
  );

  let items: Record<string, string | Record<string, string>> = {};

  if (await fs.pathExists(expoPlistPath)) {
    const expoPlistContent = await fs.readFile(expoPlistPath, 'utf8');
    items = plist.parse(expoPlistContent);
  }
  items[iosMetadataName] = iosMetadataValue;
  const expoPlist = plist.build(items);

  if (!(await fs.pathExists(path.dirname(expoPlistPath)))) {
    await fs.mkdirp(path.dirname(expoPlistPath));
  }

  await fs.writeFile(expoPlistPath, expoPlist);
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
// TODO, add some sort of dependent typing,
async function getIosMetadataEntryAsync({
  reactNativeProjectDirectory,
  iosMetadataName,
}: {
  reactNativeProjectDirectory: string;
  iosMetadataName: IosMetadataName;
}): Promise<string | Record<string, string> | undefined> {
  const expoPlistPath = path.resolve(
    await getExpoPlistDirectoryAsync(reactNativeProjectDirectory),
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
  return parsedPlist[iosMetadataName];
}

export { setIosMetadataEntryAsync, getIosMetadataEntryAsync };
