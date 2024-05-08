import path from 'path';

import { Job } from '@expo/eas-build-job';
import spawn, { SpawnOptions, SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
import fs from 'fs-extra';

import { BuildContext } from '../context';
import { findPackagerRootDir, PackageManager } from '../utils/packageManager';

/**
 * check if .yarnrc.yml exists in the project dir or in the workspace root dir
 */
export async function isUsingYarn2(projectDir: string): Promise<boolean> {
  const yarnrcPath = path.join(projectDir, '.yarnrc.yml');
  const yarnrcRootPath = path.join(findPackagerRootDir(projectDir), '.yarnrc.yml');
  return (await fs.pathExists(yarnrcPath)) || (await fs.pathExists(yarnrcRootPath));
}

export function runExpoCliCommand<TJob extends Job>(
  ctx: BuildContext<TJob>,
  args: string[],
  options: SpawnOptions
): SpawnPromise<SpawnResult> {
  const argsWithExpo = ['expo', ...args];
  if (ctx.packageManager === PackageManager.NPM) {
    return spawn('npx', argsWithExpo, options);
  } else if (ctx.packageManager === PackageManager.YARN) {
    return spawn('yarn', argsWithExpo, options);
  } else if (ctx.packageManager === PackageManager.PNPM) {
    return spawn('pnpm', argsWithExpo, options);
  } else if (ctx.packageManager === PackageManager.BUN) {
    return spawn('bun', argsWithExpo, options);
  } else {
    throw new Error(`Unsupported package manager: ${ctx.packageManager}`);
  }
}

export function readPackageJson(projectDir: string): any {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!fs.pathExistsSync(packageJsonPath)) {
    throw new Error(`package.json does not exist in ${projectDir}`);
  }
  try {
    return fs.readJSONSync(packageJsonPath);
  } catch (err: any) {
    throw new Error(`Failed to parse or read package.json: ${err.message}`);
  }
}
