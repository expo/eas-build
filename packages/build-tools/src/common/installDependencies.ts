import path from 'path';

import { Job } from '@expo/eas-build-job';
import spawn, { SpawnPromise, SpawnResult, SpawnOptions } from '@expo/turtle-spawn';

import { BuildContext } from '../context';
import { PackageManager, findPackagerRootDir } from '../utils/packageManager';
import { isUsingModernYarnVersion } from '../utils/project';

export async function installDependenciesAsync({
  packageManager,
  env,
  logger,
  infoCallbackFn,
  cwd,
  useFrozenLockfile,
}: {
  packageManager: PackageManager;
  env: Record<string, string | undefined>;
  cwd: string;
  logger: Exclude<SpawnOptions['logger'], undefined>;
  infoCallbackFn?: SpawnOptions['infoCallbackFn'];
  useFrozenLockfile: boolean;
}): Promise<{ spawnPromise: SpawnPromise<SpawnResult> }> {
  let args: string[];
  switch (packageManager) {
    case PackageManager.NPM: {
      args = [useFrozenLockfile ? 'ci' : 'install'];
      break;
    }
    case PackageManager.PNPM: {
      args = ['install', useFrozenLockfile ? '--frozen-lockfile' : '--no-frozen-lockfile'];
      break;
    }
    case PackageManager.YARN: {
      const isModernYarnVersion = await isUsingModernYarnVersion(cwd);
      if (isModernYarnVersion) {
        args = ['install', '--inline-builds', useFrozenLockfile ? '--immutable' : '--no-immutable'];
      } else {
        args = ['install', ...(useFrozenLockfile ? ['--frozen-lockfile'] : [])];
      }
      break;
    }
    case PackageManager.BUN:
      args = ['install', ...(useFrozenLockfile ? ['--frozen-lockfile'] : [])];
      break;
    default:
      throw new Error(`Unsupported package manager: ${packageManager}`);
  }
  if (env['EAS_CUSTOM_INSTALL_DEPENDENCIES']) {
    args = env['EAS_CUSTOM_INSTALL_DEPENDENCIES'].split(' ');
  }
  if (env['EAS_VERBOSE'] === '1') {
    args = [...args, '--verbose'];
  }
  logger.info(`Running "${packageManager} ${args.join(' ')}" in ${cwd} directory`);
  return {
    spawnPromise: spawn(packageManager, args, {
      cwd,
      logger,
      infoCallbackFn,
      env,
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
