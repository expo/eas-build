import path from 'path';

import { Job,  } from '@expo/eas-build-job';
import spawn, { SpawnOptions, SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
import fs from 'fs-extra';
import semver from 'semver';

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
  options: SpawnOptions,
  { forceUseGlobalExpoCli = false } = {}
): SpawnPromise<SpawnResult> {
  if (shouldUseGlobalExpoCli(ctx, forceUseGlobalExpoCli)) {
    return ctx.runGlobalExpoCliCommand(args.join(' '), options);
  } else {
    const argsWithExpo = ['expo', ...args];
    if (ctx.packageManager === PackageManager.NPM) {
      return spawn('npx', argsWithExpo, options);
    } else if (ctx.packageManager === PackageManager.YARN) {
      return spawn('yarn', argsWithExpo, options);
    } else if (ctx.packageManager === PackageManager.PNPM) {
      return spawn('pnpm', argsWithExpo, options);
    } else {
      throw new Error(`Unsupported package manager: ${ctx.packageManager}`);
    }
  }
}

export function shouldUseGlobalExpoCli<TJob extends Job>(
  ctx: BuildContext<TJob>,
  forceUseGlobalExpoCli = false
): boolean {
  return (
    forceUseGlobalExpoCli ||
    ctx.env.EXPO_USE_LOCAL_CLI === '0' ||
    !ctx.appConfig.sdkVersion ||
    semver.satisfies(ctx.appConfig.sdkVersion, '<46')
  );
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
