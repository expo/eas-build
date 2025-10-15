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
    const key = await hashFilesAsync([lockPath]);
    return `${prefix}${key}`;
  } catch (err: any) {
    throw new Error(`Failed to read package files for cache key generation: ${err.message}`);
  }
}

/**
 * Hashes the contents of multiple files and returns a combined SHA256 hash.
 * @param filePaths Array of absolute file paths to hash
 * @returns Combined SHA256 hash of all files, or empty string if no files exist
 */
export async function hashFilesAsync(filePaths: string[]): Promise<string> {
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

  if (hashes.length === 0) {
    return '';
  }

  const combinedHashes = hashes.join('');
  return createHash('sha256').update(combinedHashes).digest('hex');
}

/**
 * Synchronous version of hashFilesAsync.
 * Hashes the contents of multiple files and returns a combined SHA256 hash.
 * @param filePaths Array of absolute file paths to hash
 * @returns Combined SHA256 hash of all files, or empty string if no files exist
 */
export function hashFilesSync(filePaths: string[]): string {
  const hashes: string[] = [];

  for (const filePath of filePaths) {
    try {
      if (fs.pathExistsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath);
        const fileHash = createHash('sha256').update(fileContent).digest('hex');
        hashes.push(fileHash);
      }
    } catch (err: any) {
      throw new Error(`Failed to hash file ${filePath}: ${err.message}`);
    }
  }

  if (hashes.length === 0) {
    return '';
  }

  const combinedHashes = hashes.join('');
  return createHash('sha256').update(combinedHashes).digest('hex');
}
