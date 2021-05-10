import { isUsingYarn } from '@expo/package-manager';
import findYarnWorkspaceRoot from 'find-yarn-workspace-root';

export enum PackageManager {
  YARN = 'yarn',
  NPM = 'npm',
}

export function resolvePackageManager(directory: string): PackageManager {
  try {
    return isUsingYarn(directory) ? PackageManager.YARN : PackageManager.NPM;
  } catch {
    return PackageManager.YARN;
  }
}

export function findPackagerRootDir(currentDir: string): string {
  return findYarnWorkspaceRoot(currentDir) ?? currentDir;
}
