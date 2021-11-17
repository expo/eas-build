import path from 'path';

import { Ios } from '@expo/eas-build-job';
import fastlane from '@expo/fastlane';
import fs from 'fs-extra';
import nullthrows from 'nullthrows';

import { BuildContext } from '../context';

import { createGymfileForArchiveBuild, createGymfileForSimulatorBuild } from './gymfile';
import { Credentials } from './credentials/manager';
import { XcodeBuildLogger } from './xcpretty';

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
  const logsDirectory = path.join(ctx.workingdir, 'logs');
  await ensureGymfileExists(ctx, {
    scheme,
    buildConfiguration,
    credentials,
    logsDirectory,
    entitlements,
  });
  const buildLogger = new XcodeBuildLogger(ctx.logger, ctx.reactNativeProjectDirectory);
  void buildLogger.watchLogFiles(logsDirectory);
  try {
    await fastlane(['gym'], {
      cwd: path.join(ctx.reactNativeProjectDirectory, 'ios'),
      logger: ctx.logger,
      envs: ctx.env,
    });
  } finally {
    await buildLogger.flush();
  }
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
  const gymfilePath = path.join(ctx.reactNativeProjectDirectory, 'ios/Gymfile');

  if (await fs.pathExists(gymfilePath)) {
    ctx.logger.info('Gymfile already exists');
    return;
  }

  ctx.logger.info('Creating Gymfile');
  if (ctx.job.simulator) {
    await createGymfileForSimulatorBuild({
      outputFile: gymfilePath,
      scheme,
      buildConfiguration: buildConfiguration ?? 'release',
      derivedDataPath: './build',
      clean: false,
      logsDirectory,
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
