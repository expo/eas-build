import path from 'path';

import { Job } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import spawn from '@expo/turtle-spawn';

import { BuildContext } from '../context';
import { PackageManager, findPackagerRootDir } from '../utils/packageManager';
import { isUsingYarn2 } from '../utils/project';

export async function installDependenciesAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  { logger, workingDir }: { logger: bunyan; workingDir: string }
): Promise<void> {
  let args = ['install'];
  if (ctx.packageManager === PackageManager.PNPM) {
    args = ['install', '--no-frozen-lockfile'];
  } else if (ctx.packageManager === PackageManager.YARN) {
    const isYarn2 = await isUsingYarn2(ctx.getReactNativeProjectDirectory());
    if (isYarn2) {
      args = ['install', '--no-immutable'];
    }
  }
  logger.info(`Running "${ctx.packageManager} ${args.join(' ')}" in ${workingDir} directory`);
  await spawn(ctx.packageManager, args, {
    cwd: workingDir,
    logger,
    env: ctx.env,
  });
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
