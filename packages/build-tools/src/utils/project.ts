import path from 'path';

import { Job } from '@expo/eas-build-job';
import spawn, { SpawnOptions, SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
import fs from 'fs-extra';
import semver from 'semver';
import { ExpoConfig } from '@expo/config';

import { BuildContext } from '../context';
import { findPackagerRootDir, isAtLeastNpm7Async, PackageManager } from '../utils/packageManager';

/**
 * check if .yarnrc.yml exists in the project dir or in the workspace root dir
 */
export async function isUsingYarn2(projectDir: string): Promise<boolean> {
  const yarnrcPath = path.join(projectDir, '.yarnrc.yml');
  const yarnrcRootPath = path.join(findPackagerRootDir(projectDir), '.yarnrc.yml');
  return (await fs.pathExists(yarnrcPath)) || (await fs.pathExists(yarnrcRootPath));
}

export async function runExpoCliCommand<TJob extends Job>(
  ctx: BuildContext<TJob>,
  args: string[],
  options: SpawnOptions,
  {
    forceUseGlobalExpoCli = false,
    npmVersionAtLeast7,
  }: { forceUseGlobalExpoCli?: boolean; npmVersionAtLeast7: boolean }
): Promise<SpawnPromise<SpawnResult>> {
  if (await shouldUseGlobalExpoCli(ctx, forceUseGlobalExpoCli)) {
    return ctx.runGlobalExpoCliCommand(args, options, npmVersionAtLeast7);
  } else {
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
}

export async function readAppConfigUsingExpoConfigCommandAsync<TJob extends Job>(
  ctx: BuildContext<TJob>
): Promise<ExpoConfig | null> {
  try {
    const { stdout } = await runExpoCliCommand(
      ctx,
      ['config', '--type', 'public', '--json'],
      {
        cwd: ctx.getReactNativeProjectDirectory(),
        logger: ctx.logger,
        env: ctx.env,
      },
      {
        npmVersionAtLeast7: await isAtLeastNpm7Async(),
      }
    );
    return JSON.parse(stdout) as ExpoConfig;
  } catch {
    return null;
  }
}

export async function shouldUseGlobalExpoCli<TJob extends Job>(
  ctx: BuildContext<TJob>,
  forceUseGlobalExpoCli = false
): Promise<boolean> {
  const config = await ctx.getAppConfig();
  return (
    forceUseGlobalExpoCli ||
    ctx.env.EXPO_USE_LOCAL_CLI === '0' ||
    !config.sdkVersion ||
    semver.satisfies(config.sdkVersion, '<46')
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
