import path from 'path';

import * as PackageManagerUtils from '@expo/package-manager';
import { hashFilesAsync } from '@expo/steps';

import { findPackagerRootDir } from './packageManager';

export async function generateCacheKeyAsync(
  workingDirectory: string,
  prefix: string
): Promise<string> {
  // This will resolve which package manager and use the relevant lock file
  // The lock file hash is the key and ensures cache is fresh
  const packagerRunDir = findPackagerRootDir(workingDirectory);
  const manager = PackageManagerUtils.createForProject(packagerRunDir);
  const lockPath = path.join(packagerRunDir, manager.lockFile);

  try {
    const key = await hashFilesAsync([lockPath]);
    return `${prefix}${key}`;
  } catch (err: any) {
    throw new Error(`Failed to read package files for cache key generation: ${err.message}`);
  }
}
