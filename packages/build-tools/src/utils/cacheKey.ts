import path from 'path';

import * as PackageManagerUtils from '@expo/package-manager';
import { hashFiles } from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { IOS_CACHE_KEY_PREFIX, ANDROID_CACHE_KEY_PREFIX } from './constants';
import { findPackagerRootDir } from './packageManager';

const platformToBuildCacheKeyPrefix: Record<Platform, string> = {
  [Platform.ANDROID]: ANDROID_CACHE_KEY_PREFIX,
  [Platform.IOS]: IOS_CACHE_KEY_PREFIX,
};

export async function generateDefaultBuildCacheKeyAsync(
  workingDirectory: string,
  platform: Platform
): Promise<string> {
  // This will resolve which package manager and use the relevant lock file
  // The lock file hash is the key and ensures cache is fresh
  const packagerRunDir = findPackagerRootDir(workingDirectory);
  const manager = PackageManagerUtils.createForProject(packagerRunDir);
  const lockPath = path.join(packagerRunDir, manager.lockFile);

  try {
    return `${platformToBuildCacheKeyPrefix[platform]}${hashFiles([lockPath])}`;
  } catch (err: any) {
    throw new Error(`Failed to read lockfile for cache key generation: ${err.message}`);
  }
}
