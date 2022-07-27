import * as PackageManagerUtils from '@expo/package-manager';

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
