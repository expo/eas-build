import spawnAsync from '@expo/turtle-spawn';
import * as PackageManagerUtils from '@expo/package-manager';
import semver from 'semver';
import { z } from 'zod';

export enum PackageManager {
  YARN = 'yarn',
  NPM = 'npm',
  PNPM = 'pnpm',
  BUN = 'bun',
}

export function resolvePackageManager(directory: string): PackageManager {
  try {
    const manager = PackageManagerUtils.resolvePackageManager(directory);
    if (manager === 'npm') {
      return PackageManager.NPM;
    } else if (manager === 'pnpm') {
      return PackageManager.PNPM;
    } else if (manager === 'bun') {
      return PackageManager.BUN;
    } else {
      return PackageManager.YARN;
    }
  } catch {
    return PackageManager.YARN;
  }
}

export function findPackagerRootDir(currentDir: string): string {
  return PackageManagerUtils.resolveWorkspaceRoot(currentDir) ?? currentDir;
}

export async function isAtLeastNpm7Async(): Promise<boolean> {
  const version = (await spawnAsync('npm', ['--version'], { stdio: 'pipe' })).stdout.trim();
  return semver.gte(version, '7.0.0');
}

const PackageJsonZ = z.object({
  dependencies: z
    .object({
      expo: z.string().optional(),
      'react-native': z.string().optional(),
    })
    .optional(),
});

export function shouldUseFrozenLockfile({
  env,
  packageJson,
}: {
  env: Record<string, string | undefined>;
  packageJson: unknown;
}): boolean {
  if (env.EAS_NO_FROZEN_LOCKFILE) {
    return false;
  }

  const parsedPackageJson = PackageJsonZ.safeParse(packageJson);
  if (!parsedPackageJson.success) {
    // We don't know what the dependencies are,
    // so we default to NOT using frozen lockfile.
    return false;
  }

  const dependencies = parsedPackageJson.data.dependencies;

  const sdkVersion = semver.coerce(dependencies?.expo)?.version;
  if (sdkVersion && semver.lt(sdkVersion, '52.0.0')) {
    // Before SDK 52 we could not have used frozen lockfile.
    return false;
  }

  const reactNativeVersion = semver.coerce(dependencies?.['react-native'])?.version;
  if (reactNativeVersion && semver.lt(reactNativeVersion, '0.76')) {
    // Before react-native 0.76 we could not have used frozen lockfile.
    return false;
  }

  // We either don't know expo and react-native versions,
  // so we can try to use frozen lockfile, or the versions are
  // new enough that we do want to use it.
  return true;
}
