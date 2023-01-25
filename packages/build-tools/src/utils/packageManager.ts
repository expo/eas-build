import spawnAsync from '@expo/turtle-spawn';
import * as PackageManagerUtils from '@expo/package-manager';
import semver from 'semver';

export enum PackageManager {
  YARN = 'yarn',
  NPM = 'npm',
  PNPM = 'pnpm',
}

export function resolvePackageManager(directory: string): PackageManager {
  try {
    const manager = PackageManagerUtils.resolvePackageManager(directory);
    if (manager === 'npm') {
      return PackageManager.NPM;
    } else if (manager === 'pnpm') {
      return PackageManager.PNPM;
    } else {
      return PackageManager.YARN;
    }
  } catch {
    return PackageManager.YARN;
  }
}

export function findPackagerRootDir(currentDir: string): string {
  return PackageManagerUtils.findWorkspaceRoot(currentDir) ?? currentDir;
}

export async function isAtLeastNpm7Async(): Promise<boolean> {
  const version = (await spawnAsync('npm', ['--version'], { stdio: 'pipe' })).stdout.trim();
  return semver.gte(version, '7.0.0');
}
