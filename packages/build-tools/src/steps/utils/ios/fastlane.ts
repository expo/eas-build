import path from 'path';

import { bunyan } from '@expo/logger';
import spawn, { SpawnResult } from '@expo/turtle-spawn';
import { BuildStepEnv } from '@expo/steps';

import { XcodeBuildLogger } from './xcpretty';

export async function runFastlaneGym({
  workingDir,
  logger,
  buildLogsDirectory,
  env,
  extraEnv,
}: {
  workingDir: string;
  logger: bunyan;
  buildLogsDirectory: string;
  env: BuildStepEnv;
  extraEnv?: BuildStepEnv;
}): Promise<void> {
  const buildLogger = new XcodeBuildLogger(logger, workingDir);
  void buildLogger.watchLogFiles(buildLogsDirectory);
  try {
    await runFastlane(['gym'], {
      cwd: path.join(workingDir, 'ios'),
      logger,
      env,
      extraEnv,
    });
  } finally {
    await buildLogger.flush();
  }
}

export async function runFastlane(
  fastlaneArgs: string[],
  {
    logger,
    env,
    cwd,
    extraEnv,
  }: {
    logger?: bunyan;
    env?: BuildStepEnv;
    cwd?: string;
    extraEnv?: BuildStepEnv;
  } = {}
): Promise<SpawnResult> {
  const fastlaneEnvVars = {
    FASTLANE_DISABLE_COLORS: '1',
    FASTLANE_SKIP_UPDATE_CHECK: '1',
    SKIP_SLOW_FASTLANE_WARNING: 'true',
    FASTLANE_HIDE_TIMESTAMP: 'true',
    LC_ALL: 'en_US.UTF-8',
    ...(env ?? process.env),
    ...extraEnv,
  };
  return await spawn('fastlane', fastlaneArgs, {
    env: fastlaneEnvVars,
    logger,
    cwd,
  });
}
