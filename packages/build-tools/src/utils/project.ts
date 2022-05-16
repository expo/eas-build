import path from 'path';

import downloadFile from '@expo/downloader';
import { ArchiveSourceType, BuildPhase, Job } from '@expo/eas-build-job';
import spawn, { SpawnResult } from '@expo/turtle-spawn';
import fs from 'fs-extra';

import { BuildContext } from '../context';

import { Hook, runHookIfPresent } from './hooks';
import { createNpmrcIfNotExistsAsync } from './npmrc';
import { findPackagerRootDir, readPackageJson } from './packageManager';

const MAX_EXPO_DOCTOR_TIMEOUT_MS = 20 * 1000;

export async function setup<TJob extends Job>(ctx: BuildContext<TJob>): Promise<void> {
  await ctx.runBuildPhase(BuildPhase.PREPARE_PROJECT, async () => {
    await downloadAndUnpackProject(ctx);
    if (ctx.env.NPM_TOKEN) {
      await createNpmrcIfNotExistsAsync(ctx);
    }
  });

  await ctx.runBuildPhase(BuildPhase.PRE_INSTALL_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_INSTALL);
  });

  await ctx.runBuildPhase(BuildPhase.INSTALL_DEPENDENCIES, async () => {
    await installDependencies(ctx);
  });

  const packageJson = await ctx.runBuildPhase(BuildPhase.READ_PACKAGE_JSON, async () => {
    const packageJsonContents = await readPackageJson(ctx.reactNativeProjectDirectory);
    ctx.logger.info('Using package.json:');
    ctx.logger.info(JSON.stringify(packageJsonContents, null, 2));
    return packageJsonContents;
  });

  await ctx.runBuildPhase(BuildPhase.READ_APP_CONFIG, async () => {
    const appConfig = ctx.appConfig;
    ctx.logger.info('Using app configuration:');
    ctx.logger.info(JSON.stringify(appConfig, null, 2));
  });

  const hasExpoPackage = !!packageJson?.dependencies?.expo;
  if (hasExpoPackage) {
    await ctx.runBuildPhase(BuildPhase.RUN_EXPO_DOCTOR, async () => {
      try {
        const { stdout } = await runExpoDoctor(ctx);
        if (!stdout.match(/Didn't find any issues with the project/)) {
          ctx.markBuildPhaseHasWarnings();
        }
      } catch (err) {
        ctx.logger.error({ err }, 'Command "expo doctor" failed.');
        ctx.markBuildPhaseHasWarnings();
      }
    });
  }
}

async function downloadAndUnpackProject<TJob extends Job>(ctx: BuildContext<TJob>): Promise<void> {
  const projectTarball = path.join(ctx.workingdir, 'project.tar.gz');
  if (ctx.job.projectArchive.type === ArchiveSourceType.S3) {
    throw new Error('ArchiveSourceType.S3 should be resolved earlier to url');
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.PATH) {
    await fs.copy(ctx.job.projectArchive.path, projectTarball); // used in eas-build-cli
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.URL) {
    try {
      await downloadFile(ctx.job.projectArchive.url, projectTarball, { retry: 3 });
    } catch (err: any) {
      ctx?.reportError?.('Failed to download project archive', err);
      throw err;
    }
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

export async function installDependencies<TJob extends Job>(
  ctx: BuildContext<TJob>
): Promise<void> {
  const packagerRunDir = findPackagerRootDir(ctx.reactNativeProjectDirectory);
  if (packagerRunDir !== ctx.reactNativeProjectDirectory) {
    const relativeReactNativeProjectDirectory = path.relative(
      ctx.buildDirectory,
      ctx.reactNativeProjectDirectory
    );
    ctx.logger.info(
      `We detected that '${relativeReactNativeProjectDirectory}' is a ${ctx.packageManager} workspace`
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
  const { CI, EAS_BUILD, ...nonCIEnvs } = ctx.env;
  await spawn(ctx.packageManager, ['install'], {
    cwd: packagerRunDir,
    logger: ctx.logger,
    env: nonCIEnvs,
  });
}

async function runExpoDoctor<TJob extends Job>(ctx: BuildContext<TJob>): Promise<SpawnResult> {
  ctx.logger.info('Running "expo doctor"');
  let timeout: NodeJS.Timeout | undefined;
  try {
    const promise = ctx.runExpoCliCommand('doctor', {
      cwd: ctx.reactNativeProjectDirectory,
      logger: ctx.logger,
      env: ctx.env,
    });
    timeout = setTimeout(() => {
      promise.child.kill();
      ctx?.reportError?.(`"expo doctor" timed out`);
    }, MAX_EXPO_DOCTOR_TIMEOUT_MS);
    return await promise;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
