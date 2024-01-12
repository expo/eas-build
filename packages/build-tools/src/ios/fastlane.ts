import path from 'path';

import { Ios } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import spawn, { SpawnResult } from '@expo/turtle-spawn';
import fs from 'fs-extra';
import nullthrows from 'nullthrows';

import { BuildContext, SkipNativeBuildError } from '../context';

import { createGymfileForArchiveBuild, createGymfileForSimulatorBuild } from './gymfile';
import { Credentials } from './credentials/manager';
import { XcodeBuildLogger } from './xcpretty';
import { isTVOS } from './tvos';
import { createFastfileForResigningBuild } from './fastfile';

export async function runFastlaneGym<TJob extends Ios.Job>(
  ctx: BuildContext<TJob>,
  {
    scheme,
    buildConfiguration,
    credentials,
    entitlements,
  }: {
    scheme: string;
    buildConfiguration?: string;
    credentials: Credentials | null;
    entitlements: object | null;
  }
): Promise<void> {
  await ensureGymfileExists(ctx, {
    scheme,
    buildConfiguration,
    credentials,
    logsDirectory: ctx.buildLogsDirectory,
    entitlements,
  });
  if (ctx.skipNativeBuild) {
    throw new SkipNativeBuildError('Skipping fastlane build');
  }
  const buildLogger = new XcodeBuildLogger(ctx.logger, ctx.getReactNativeProjectDirectory());
  void buildLogger.watchLogFiles(ctx.buildLogsDirectory);
  try {
    await runFastlane(['gym'], {
      cwd: path.join(ctx.getReactNativeProjectDirectory(), 'ios'),
      logger: ctx.logger,
      env: ctx.env,
    });
  } finally {
    await buildLogger.flush();
  }
}

export async function runFastlaneResign<TJob extends Ios.Job>(
  ctx: BuildContext<TJob>,
  { credentials, ipaPath }: { credentials: Credentials; ipaPath: string }
): Promise<void> {
  const { certificateCommonName } = credentials.applicationTargetProvisioningProfile.data;

  const fastlaneDirPath = path.join(ctx.buildDirectory, 'fastlane');
  await fs.ensureDir(fastlaneDirPath);
  const fastfilePath = path.join(fastlaneDirPath, 'Fastfile');
  await createFastfileForResigningBuild({
    outputFile: fastfilePath,
    ipaPath,
    keychainPath: credentials.keychainPath,
    signingIdentity: certificateCommonName,
    targetProvisioningProfiles: credentials.targetProvisioningProfiles,
  });

  await runFastlane(['do_resign'], {
    cwd: ctx.buildDirectory,
    logger: ctx.logger,
    env: ctx.env,
  });
}

export async function runFastlane(
  fastlaneArgs: string[],
  {
    logger,
    env,
    cwd,
  }: {
    logger?: bunyan;
    env?: Record<string, string>;
    cwd?: string;
  } = {}
): Promise<SpawnResult> {
  const fastlaneEnvVars = {
    FASTLANE_DISABLE_COLORS: '1',
    FASTLANE_SKIP_UPDATE_CHECK: '1',
    SKIP_SLOW_FASTLANE_WARNING: 'true',
    FASTLANE_HIDE_TIMESTAMP: 'true',
    LC_ALL: 'en_US.UTF-8',
    ...(env ?? process.env),
  };
  return await spawn('fastlane', fastlaneArgs, {
    env: fastlaneEnvVars,
    logger,
    cwd,
  });
}

async function ensureGymfileExists<TJob extends Ios.Job>(
  ctx: BuildContext<TJob>,
  {
    scheme,
    buildConfiguration,
    credentials,
    logsDirectory,
    entitlements,
  }: {
    scheme: string;
    buildConfiguration?: string;
    credentials: Credentials | null;
    logsDirectory: string;
    entitlements: object | null;
  }
): Promise<void> {
  const gymfilePath = path.join(ctx.getReactNativeProjectDirectory(), 'ios/Gymfile');

  if (await fs.pathExists(gymfilePath)) {
    ctx.logger.info('Gymfile already exists');
    return;
  }

  ctx.logger.info('Creating Gymfile');
  if (ctx.job.simulator) {
    const isTV = await isTVOS(ctx);
    const simulatorDestination = `generic/platform=${isTV ? 'tvOS' : 'iOS'} Simulator`;

    await createGymfileForSimulatorBuild({
      outputFile: gymfilePath,
      scheme,
      buildConfiguration: buildConfiguration ?? 'release',
      derivedDataPath: './build',
      clean: false,
      logsDirectory,
      simulatorDestination,
    });
  } else {
    await createGymfileForArchiveBuild({
      outputFile: gymfilePath,
      credentials: nullthrows(credentials, 'credentials must exist for non-simulator builds'),
      scheme,
      buildConfiguration,
      outputDirectory: './build',
      clean: false,
      logsDirectory,
      entitlements: entitlements ?? undefined,
    });
  }

  ctx.logger.info('Gymfile created');
}
