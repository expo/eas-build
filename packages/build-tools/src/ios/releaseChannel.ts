import path from 'path';

import plist from '@expo/plist';
import fg from 'fast-glob';
import fs from 'fs-extra';

async function updateReleaseChannel(
  reactNativeProjectDirectory: string,
  releaseChannel: string
): Promise<void> {
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

  let items: Record<string, string> = {};

  if (await fs.pathExists(expoPlistPath)) {
    const expoPlistContent = await fs.readFile(expoPlistPath, 'utf8');
    items = plist.parse(expoPlistContent);
  }

  items.EXUpdatesReleaseChannel = releaseChannel;

  const expoPlist = plist.build(items);

  if (!(await fs.pathExists(path.dirname(expoPlistPath)))) {
    await fs.mkdirp(path.dirname(expoPlistPath));
  }

  await fs.writeFile(expoPlistPath, expoPlist);
}

async function getReleaseChannel(reactNativeProjectDirectory: string): Promise<string | undefined> {
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

  if (!(await fs.pathExists(expoPlistPath))) {
    return;
  }
  const expoPlistContent = await fs.readFile(expoPlistPath, 'utf8');
  return plist.parse(expoPlistContent)?.EXUpdatesReleaseChannel;
}

export { updateReleaseChannel, getReleaseChannel };
