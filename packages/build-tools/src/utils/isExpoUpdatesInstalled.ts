import path from 'path';

import fs from 'fs-extra';

export default async function isExpoUpdatesInstalledAsync(
  reactNativeProjectDirectory: string
): Promise<boolean> {
  const packageJsonPath = path.join(reactNativeProjectDirectory, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  return packageJson.dependencies ? 'expo-updates' in packageJson.dependencies : false;
}
