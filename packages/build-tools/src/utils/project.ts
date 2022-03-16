import path from 'path';

import downloadFile from '@expo/downloader';
import { ArchiveSourceType, BuildPhase, Job } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';
import fs from 'fs-extra';

import { BuildContext } from '../context';

import { Hook, runHookIfPresent } from './hooks';
import { createNpmrcIfNotExistsAsync } from './npmrc';
import { findPackagerRootDir, readPackageJson } from './packageManager';

export async function setup<TJob extends Job>(ctx: BuildContext<TJob>): Promise<void> {
  await ctx.runBuildPhase(BuildPhase.PREPARE_PROJECT, async () => {
    await downloadAndUnpackProject(ctx);
    if (ctx.env.NPM_TOKEN) {
      await createNpmrcIfNotExistsAsync(ctx);
    }
  });

  await ctx.runBuildPhase(BuildPhase.READ_PACKAGE_JSON, async () => {
    try {
      const packageJsonContents = await readPackageJson(ctx.reactNativeProjectDirectory);
      ctx.logger.info('Using package.json:');
      ctx.logger.info(JSON.stringify(packageJsonContents, null, 2));
    } catch (err: any) {
      ctx.logger.warn(`Failed to parse or read package.json: ${err.message}`);
    }
  });

  await ctx.runBuildPhase(BuildPhase.PRE_INSTALL_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_INSTALL);
  });

  await ctx.runBuildPhase(BuildPhase.INSTALL_DEPENDENCIES, async () => {
    await installDependencies(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.READ_APP_CONFIG, async () => {
    const appConfig = ctx.appConfig;
    ctx.logger.info('Using app configuration:');
    ctx.logger.info(JSON.stringify(appConfig, null, 2));
  });
}

async function downloadAndUnpackProject<TJob extends Job>(ctx: BuildContext<TJob>): Promise<void> {
  const projectTarball = path.join(ctx.workingdir, 'project.tar.gz');
  if (ctx.job.projectArchive.type === ArchiveSourceType.S3) {
    throw new Error('ArchiveSourceType.S3 should be resolved earlier to url');
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.PATH) {
    await fs.copy(ctx.job.projectArchive.path, projectTarball); // used in eas-build-cli
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.URL) {
    await downloadFile(ctx.job.projectArchive.url, projectTarball);
  }

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
    ctx.logger.info(`We detected that '${relativeReactNativeProjectDirectory}' is a workspace`);
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
