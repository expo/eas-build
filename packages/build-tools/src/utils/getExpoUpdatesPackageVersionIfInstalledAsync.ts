import fs from 'fs-extra';
import resolveFrom from 'resolve-from';

export default async function getExpoUpdatesPackageVersionIfInstalledAsync(
  reactNativeProjectDirectory: string
): Promise<string | null> {
  const maybePackageJson = resolveFrom.silent(
    reactNativeProjectDirectory,
    'expo-updates/package.json'
  );

  if (maybePackageJson) {
    const { version } = await fs.readJson(maybePackageJson);
    return version;
  }

  return null;
}
