import path from 'path';

import * as PackageManagerUtils from '@expo/package-manager';
import { hashFiles } from '@expo/steps';

import { findPackagerRootDir } from './packageManager';

export async function generateDefaultBuildCacheKeyAsync(workingDirectory: string): Promise<string> {
  // This will resolve which package manager and use the relevant lock file
  // The lock file hash is the key and ensures cache is fresh
  const packagerRunDir = findPackagerRootDir(workingDirectory);
  const manager = PackageManagerUtils.createForProject(packagerRunDir);
  const lockPath = path.join(packagerRunDir, manager.lockFile);

  try {
    return hashFiles([lockPath]);
  } catch (err: any) {
    throw new Error(`Failed to read lockfile for cache key generation: ${err.message}`);
  }
}
