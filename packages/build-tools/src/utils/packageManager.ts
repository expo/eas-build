import { isUsingYarn } from '@expo/package-manager';

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
