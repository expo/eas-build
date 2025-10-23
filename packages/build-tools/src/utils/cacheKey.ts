import path from 'path';
import os from 'os';
import assert from 'assert';

import * as PackageManagerUtils from '@expo/package-manager';
import { hashFiles } from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { findPackagerRootDir } from './packageManager';

export const IOS_CACHE_KEY_PREFIX = 'ios-ccache-';
export const ANDROID_CACHE_KEY_PREFIX = 'android-ccache-';
export const DARWIN_CACHE_PATH = 'Library/Caches/ccache';
export const LINUX_CACHE_PATH = '.cache/ccache';

export const CACHE_KEY_PREFIX_BY_PLATFORM: Record<Platform, string> = {
  [Platform.ANDROID]: ANDROID_CACHE_KEY_PREFIX,
  [Platform.IOS]: IOS_CACHE_KEY_PREFIX,
};

export const PATH_BY_PLATFORM: Record<string, string> = {
  darwin: DARWIN_CACHE_PATH,
  linux: LINUX_CACHE_PATH,
};

export function getCcachePath(homeDir: string | undefined): string[] {
  assert(homeDir, 'Failed to infer directory to save ccache: $HOME environment variable is empty.');
  return [path.join(homeDir, PATH_BY_PLATFORM[os.platform()])];
}

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
    return `${CACHE_KEY_PREFIX_BY_PLATFORM[platform]}${hashFiles([lockPath])}`;
  } catch (err: any) {
    throw new Error(`Failed to read lockfile for cache key generation: ${err.message}`);
  }
}
