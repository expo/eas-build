import { createHash } from 'crypto';
import path from 'path';

import * as PackageManagerUtils from '@expo/package-manager';
import fs from 'fs-extra';

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
    const key = await hashFiles([lockPath]);
    return `${prefix}${key}`;
  } catch (err: any) {
    throw new Error(`Failed to read package files for cache key generation: ${err.message}`);
  }
}

async function hashFiles(filePaths: string[]): Promise<string> {
  const hashes: string[] = [];

  for (const filePath of filePaths) {
    try {
      if (await fs.pathExists(filePath)) {
        const fileContent = await fs.readFile(filePath);
        const fileHash = createHash('sha256').update(fileContent).digest('hex');
        hashes.push(fileHash);
      }
    } catch (err: any) {
      throw new Error(`Failed to hash file ${filePath}: ${err.message}`);
    }
  }

  const combinedHashes = hashes.join('');
  return createHash('sha256').update(combinedHashes).digest('hex');
}
