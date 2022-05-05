import path from 'path';

import * as PackageManagerUtils from '@expo/package-manager';
import fs from 'fs-extra';

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

export async function readPackageJson(projectDir: string): Promise<any> {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error(`package.json does not exist in ${projectDir}`);
  }
  const contents = await fs.readFile(packageJsonPath, 'utf-8');
  return JSON.parse(contents);
}
