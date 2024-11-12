import path from 'path';

import semver from 'semver';
import { Job } from '@expo/eas-build-job';
import spawn, { SpawnPromise, SpawnResult, SpawnOptions } from '@expo/turtle-spawn';

import { BuildContext } from '../context';
import { PackageManager, findPackagerRootDir } from '../utils/packageManager';
import { isUsingModernYarnVersion } from '../utils/project';

export async function installDependenciesAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  {
    logger,
    infoCallbackFn,
    cwd,
    sdkVersionFromPackageJson,
    reactNativeVersionFromPackageJson,
    withoutFrozenLockfile,
  }: {
    logger?: SpawnOptions['logger'];
    infoCallbackFn?: SpawnOptions['infoCallbackFn'];
    cwd?: SpawnOptions['cwd'];
    sdkVersionFromPackageJson?: string;
    reactNativeVersionFromPackageJson?: string;
    withoutFrozenLockfile?: boolean;
  }
): Promise<{ spawnPromise: SpawnPromise<SpawnResult> }> {
  const shouldUseFrozenLockfile = Boolean(
    !withoutFrozenLockfile &&
      !ctx.env.EAS_NO_FROZEN_LOCKFILE &&
      ((!!sdkVersionFromPackageJson && semver.satisfies(sdkVersionFromPackageJson, '>=52')) ||
        (!!reactNativeVersionFromPackageJson &&
          semver.satisfies(reactNativeVersionFromPackageJson, '>=0.76')))
  );

  let args: string[];
  switch (ctx.packageManager) {
    case PackageManager.NPM: {
      args = [shouldUseFrozenLockfile ? 'ci' : 'install'];
      break;
    }
    case PackageManager.PNPM: {
      args = ['install', shouldUseFrozenLockfile ? '--frozen-lockfile' : '--no-frozen-lockfile'];
      break;
    }
    case PackageManager.YARN: {
      const isYarn2 = await isUsingModernYarnVersion(ctx.getReactNativeProjectDirectory());
      args = isYarn2
        ? ['install', shouldUseFrozenLockfile ? '--immutable' : '--no-immutable', '--inline-builds']
        : ['install', ...(shouldUseFrozenLockfile ? ['--frozen-lockfile'] : [])];
      break;
    }
    case PackageManager.BUN:
      args = ['install', ...(shouldUseFrozenLockfile ? ['--frozen-lockfile'] : [])];
      break;
    default:
      throw new Error(`Unsupported package manager: ${ctx.packageManager}`);
  }
  if (ctx.env['EAS_VERBOSE'] === '1') {
    args = [...args, '--verbose'];
  }
  logger?.info(`Running "${ctx.packageManager} ${args.join(' ')}" in ${cwd} directory`);
  return {
    spawnPromise: spawn(ctx.packageManager, args, {
      cwd,
      logger,
      infoCallbackFn,
      env: ctx.env,
    }),
  };
}

export function resolvePackagerDir(ctx: BuildContext<Job>): string {
  const packagerRunDir = findPackagerRootDir(ctx.getReactNativeProjectDirectory());
  if (packagerRunDir !== ctx.getReactNativeProjectDirectory()) {
    const relativeReactNativeProjectDirectory = path.relative(
      ctx.buildDirectory,
      ctx.getReactNativeProjectDirectory()
    );
    ctx.logger.info(
      `We detected that '${relativeReactNativeProjectDirectory}' is a ${ctx.packageManager} workspace`
    );
  }
  return packagerRunDir;
}
