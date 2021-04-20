import path from 'path';

import { Ios } from '@expo/eas-build-job';
import fastlane from '@expo/fastlane';
import fs from 'fs-extra';
import nullthrows from 'nullthrows';

import { BuildContext } from '../context';

import { createGymfileForArchiveBuild, createGymfileForSimulatorBuild } from './gymfile';
import { Credentials } from './credentials/manager';

export async function runFastlaneGym<TJob extends Ios.Job>(
  ctx: BuildContext<TJob>,
  {
    scheme,
    schemeBuildConfiguration,
    credentials,
  }: {
    scheme: string;
    schemeBuildConfiguration?: Ios.SchemeBuildConfiguration;
    credentials: Credentials | null;
  }
): Promise<void> {
  await ensureGymfileExists(ctx, { scheme, schemeBuildConfiguration, credentials });
  await fastlane(['gym'], {
    cwd: path.join(ctx.reactNativeProjectDirectory, 'ios'),
    logger: ctx.logger,
    envs: ctx.env,
  });
}

async function ensureGymfileExists<TJob extends Ios.Job>(
  ctx: BuildContext<TJob>,
  {
    scheme,
    schemeBuildConfiguration,
    credentials,
  }: {
    scheme: string;
    schemeBuildConfiguration?: Ios.SchemeBuildConfiguration;
    credentials: Credentials | null;
  }
): Promise<void> {
  const gymfilePath = path.join(ctx.reactNativeProjectDirectory, 'ios/Gymfile');

  if (await fs.pathExists(gymfilePath)) {
    ctx.logger.info('Gymfile already exists');
    return;
  }

  ctx.logger.info('Creating Gymfile');
  if (ctx.job.distribution === 'simulator') {
    await createGymfileForSimulatorBuild({
      outputFile: gymfilePath,
      scheme,
      schemeBuildConfiguration: schemeBuildConfiguration ?? Ios.SchemeBuildConfiguration.RELEASE,
      derivedDataPath: './build',
      clean: false,
    });
  } else {
    await createGymfileForArchiveBuild({
      outputFile: gymfilePath,
      credentials: nullthrows(credentials, 'credentials must exist for non-simulator builds'),
      scheme,
      schemeBuildConfiguration,
      outputDirectory: './build',
      clean: false,
    });
  }
  ctx.logger.info('Gymfile created');
}
