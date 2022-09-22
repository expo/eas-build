import path from 'path';

import downloadFile from '@expo/downloader';
import { ArchiveSourceType, BuildPhase, Ios, Job, Platform } from '@expo/eas-build-job';
import spawn, { SpawnOptions, SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
import fs from 'fs-extra';
import semver from 'semver';

import { BuildContext } from '../context';
import { deleteXcodeEnvLocalIfExistsAsync } from '../ios/xcodeEnv';

import { Hook, runHookIfPresent } from './hooks';
import { createNpmrcIfNotExistsAsync } from './npmrc';
import { findPackagerRootDir, PackageManager } from './packageManager';

const MAX_EXPO_DOCTOR_TIMEOUT_MS = 20 * 1000;

export async function setup<TJob extends Job>(ctx: BuildContext<TJob>): Promise<void> {
  const packageJson = await ctx.runBuildPhase(BuildPhase.PREPARE_PROJECT, async () => {
    await downloadAndUnpackProject(ctx);
    if (ctx.env.NPM_TOKEN) {
      await createNpmrcIfNotExistsAsync(ctx);
    }
    if (ctx.job.platform === Platform.IOS && ctx.env.EAS_BUILD_RUNNER === 'eas-build') {
      await deleteXcodeEnvLocalIfExistsAsync(ctx as BuildContext<Ios.Job>);
    }
    // try to read package.json to see if it exists and is valid
    return readPackageJson(ctx.reactNativeProjectDirectory);
  });

  await ctx.runBuildPhase(BuildPhase.PRE_INSTALL_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_INSTALL);
  });

  await ctx.runBuildPhase(BuildPhase.INSTALL_DEPENDENCIES, async () => {
    await installDependencies(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.READ_PACKAGE_JSON, async () => {
    ctx.logger.info('Using package.json:');
    ctx.logger.info(JSON.stringify(packageJson, null, 2));
  });

  await ctx.runBuildPhase(BuildPhase.READ_APP_CONFIG, async () => {
    ctx.logger.info('Using app configuration:');
    ctx.logger.info(JSON.stringify(ctx.appConfig, null, 2));
  });

  const hasExpoPackage = !!packageJson.dependencies?.expo;
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
  if ([ArchiveSourceType.S3, ArchiveSourceType.GCS].includes(ctx.job.projectArchive.type)) {
    throw new Error('GCS and S3 project sources should be resolved earlier to url');
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.PATH) {
    await fs.copy(ctx.job.projectArchive.path, projectTarball); // used in eas-build-cli
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.URL) {
    try {
      await downloadFile(ctx.job.projectArchive.url, projectTarball, { retry: 3 });
    } catch (err: any) {
      ctx.reportError?.('Failed to download project archive', err, {
        extras: { buildId: ctx.env.EAS_BUILD_ID },
      });
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
  let args = ['install'];
  if (ctx.packageManager === PackageManager.PNPM) {
    args = ['install', '--no-frozen-lockfile'];
  } else if (ctx.packageManager === PackageManager.YARN) {
    const isYarn2 = await isUsingYarn2(ctx.reactNativeProjectDirectory);
    if (isYarn2) {
      args = ['install', '--no-immutable'];
    }
  }
  ctx.logger.info(
    `Running "${ctx.packageManager} ${args.join(' ')}" in ${
      relativePackagerRunDir
        ? `directory '${relativePackagerRunDir}'`
        : 'the root dir of your repository'
    } `
  );
  await spawn(ctx.packageManager, args, {
    cwd: packagerRunDir,
    logger: ctx.logger,
    env: ctx.env,
  });
}

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

async function runExpoDoctor<TJob extends Job>(ctx: BuildContext<TJob>): Promise<SpawnResult> {
  ctx.logger.info('Running "expo doctor"');
  let timeout: NodeJS.Timeout | undefined;
  try {
    const promise = runExpoCliCommand(
      ctx,
      ['doctor'],
      {
        cwd: ctx.reactNativeProjectDirectory,
        logger: ctx.logger,
        env: ctx.env,
      },
      // local Expo CLI does not have "doctor" for now
      { forceUseGlobalExpoCli: true }
    );
    timeout = setTimeout(() => {
      promise.child.kill();
      ctx.reportError?.(`"expo doctor" timed out`, undefined, {
        extras: { buildId: ctx.env.EAS_BUILD_ID },
      });
    }, MAX_EXPO_DOCTOR_TIMEOUT_MS);
    return await promise;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
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
