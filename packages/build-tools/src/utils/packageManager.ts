import path from 'path';

import { isUsingYarn } from '@expo/package-manager';
import findYarnWorkspaceRoot from 'find-yarn-workspace-root';
import fs from 'fs-extra';

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

export async function readPackageJson(projectDir: string): Promise<any> {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error(`package.json does not exist in ${projectDir}`);
  }
  const contents = await fs.readFile(packageJsonPath, 'utf-8');
  return JSON.parse(contents);
}