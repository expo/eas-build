import path from 'path';

import downloadFile from '@expo/downloader';
import { ArchiveSourceType, BuildPhase, Job } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';
import fs from 'fs-extra';

import { BuildContext } from '../context';

import { Hook, runHookIfPresent } from './hooks';
import { findPackagerRootDir } from './packageManager';

export async function setup<TJob extends Job>(ctx: BuildContext<TJob>): Promise<void> {
  await ctx.runBuildPhase(BuildPhase.PREPARE_PROJECT, async () => {
    await downloadAndUnpackProject(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.PRE_INSTALL_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_INSTALL);
  });

  await ctx.runBuildPhase(BuildPhase.INSTALL_DEPENDENCIES, async () => {
    await installDependencies(ctx);
  });
}

async function downloadAndUnpackProject<TJob extends Job>(ctx: BuildContext<TJob>): Promise<void> {
  const projectTarball = path.join(ctx.workingdir, 'project.tar.gz');
  ctx.logger.info(
    { ...ctx.job.projectArchive, phase: BuildPhase.PREPARE_PROJECT },
    'Download project archive'
  );
  if (ctx.job.projectArchive.type === ArchiveSourceType.S3) {
    throw new Error('ArchiveSourceType.S3 should be resolved earlier to url');
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.PATH) {
    await fs.copy(ctx.job.projectArchive.path, projectTarball); // used in eas-build-cli
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.URL) {
    await downloadFile(ctx.job.projectArchive.url, projectTarball);
  }

  ctx.logger.info({ phase: BuildPhase.PREPARE_PROJECT }, 'Unpacking project archive');
  await spawn(
    'tar',
    ['--strip-components', '1', '-zxf', 'project.tar.gz', '-C', ctx.buildDirectory],
    {
      cwd: ctx.workingdir,
      logger: ctx.logger,
    }
  );
}

async function installDependencies<TJob extends Job>(ctx: BuildContext<TJob>): Promise<void> {
  const packagerRunDir = findPackagerRootDir(ctx.reactNativeProjectDirectory);
  if (packagerRunDir !== ctx.reactNativeProjectDirectory) {
    const relativeReactNativeProjectDirectory = path.relative(
      ctx.buildDirectory,
      ctx.reactNativeProjectDirectory
    );
    ctx.logger.info(
      `We have detected that '${relativeReactNativeProjectDirectory}' is a workspace`
    );
  }

  const relativePackagerRunDir = path.relative(ctx.buildDirectory, packagerRunDir);
  ctx.logger.info(
    `Running ${ctx.packageManager} in ${
      relativePackagerRunDir
        ? `directory '${relativePackagerRunDir}'`
        : 'the root dir of your repository'
    } `
  );
  await spawn(ctx.packageManager, ['install'], {
    cwd: packagerRunDir,
    logger: ctx.logger,
    env: ctx.env,
  });
}
