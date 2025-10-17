import path from 'path';

import * as PackageManagerUtils from '@expo/package-manager';
import { hashFiles } from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { IOS_CACHE_KEY_PREFIX, ANDROID_CACHE_KEY_PREFIX } from './constants';
import { findPackagerRootDir } from './packageManager';

export async function generateDefaultBuildCacheKeyAsync(
  workingDirectory: string,
  platform: string
): Promise<string> {
  // This will resolve which package manager and use the relevant lock file
  // The lock file hash is the key and ensures cache is fresh
  const packagerRunDir = findPackagerRootDir(workingDirectory);
  const manager = PackageManagerUtils.createForProject(packagerRunDir);
  const lockPath = path.join(packagerRunDir, manager.lockFile);

  const prefix = platform === Platform.IOS ? IOS_CACHE_KEY_PREFIX : ANDROID_CACHE_KEY_PREFIX;

  try {
    return `${prefix}${hashFiles([lockPath])}`;
  } catch (err: any) {
    throw new Error(`Failed to read lockfile for cache key generation: ${err.message}`);
  }
}
