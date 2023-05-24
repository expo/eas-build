import path from 'path';

import { Job } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import spawn from '@expo/turtle-spawn';

import { BuildContext } from '../context';
import { findPackagerRootDir, PackageManager } from '../utils/packageManager';
import { isUsingYarn2 } from '../utils/project';

export async function installDependenciesAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  logger: bunyan
): Promise<void> {
  const packagerRunDir = findPackagerRootDir(ctx.getReactNativeProjectDirectory());
  if (packagerRunDir !== ctx.getReactNativeProjectDirectory()) {
    const relativeReactNativeProjectDirectory = path.relative(
      ctx.buildDirectory,
      ctx.getReactNativeProjectDirectory()
    );
    logger.info(
      `We detected that '${relativeReactNativeProjectDirectory}' is a ${ctx.packageManager} workspace`
    );
  }

  const relativePackagerRunDir = path.relative(ctx.buildDirectory, packagerRunDir);
  let args = ['install'];
  if (ctx.packageManager === PackageManager.PNPM) {
    args = ['install', '--no-frozen-lockfile'];
  } else if (ctx.packageManager === PackageManager.YARN) {
    const isYarn2 = await isUsingYarn2(ctx.getReactNativeProjectDirectory());
    if (isYarn2) {
      args = ['install', '--no-immutable'];
    }
  }
  logger.info(
    `Running "${ctx.packageManager} ${args.join(' ')}" in ${
      relativePackagerRunDir
        ? `directory '${relativePackagerRunDir}'`
        : 'the root dir of your repository'
    } `
  );
  await spawn(ctx.packageManager, args, {
    cwd: packagerRunDir,
    logger,
    env: ctx.env,
  });
}
