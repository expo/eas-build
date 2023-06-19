import path from 'path';

import fs from 'fs-extra';
import { bunyan } from '@expo/logger';
import { Env } from '@expo/eas-build-job';

import { createGymfileForSimulatorBuild } from '../../../ios/gymfile';
import { XcodeBuildLogger } from '../../../ios/xcpretty';
import { runFastlane } from '../../../ios/fastlane';

import { isTVOS } from './tvos';

async function ensureGymfileExists({
  logger,
  scheme,
  buildConfiguration,
  logsDirectory,
  workingDir,
}: {
  logger: bunyan;
  scheme: string;
  buildConfiguration: string;
  logsDirectory: string;
  workingDir: string;
}): Promise<void> {
  const gymfilePath = path.join(workingDir, 'ios/Gymfile');
  if (await fs.pathExists(gymfilePath)) {
    logger.info('Gymfile already exists');
    return;
  }

  const isTV = await isTVOS({ scheme, buildConfiguration, workingDir });
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

  logger.info('Creating Gymfile');
}

export async function runFastlaneGym({
  scheme,
  buildConfiguration,
  workingDir,
  logger,
  buildLogsDirectory,
  env,
}: {
  scheme: string;
  buildConfiguration?: string;
  workingDir: string;
  logger: bunyan;
  buildLogsDirectory: string;
  env: Env;
}): Promise<void> {
  await ensureGymfileExists({
    scheme,
    buildConfiguration: buildConfiguration ?? 'release',
    logsDirectory: buildLogsDirectory,
    workingDir,
    logger,
  });
  const buildLogger = new XcodeBuildLogger(logger, workingDir);
  void buildLogger.watchLogFiles(buildLogsDirectory);
  try {
    await runFastlane(['gym'], {
      cwd: path.join(workingDir, 'ios'),
      logger,
      env,
    });
  } finally {
    await buildLogger.flush();
  }
}
