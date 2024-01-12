import path from 'path';

import { bunyan } from '@expo/logger';
import { Env } from '@expo/eas-build-job';
import spawn, { SpawnResult } from '@expo/turtle-spawn';

import { XcodeBuildLogger } from './xcpretty';

export async function runFastlaneGym({
  workingDir,
  logger,
  buildLogsDirectory,
  env,
}: {
  workingDir: string;
  logger: bunyan;
  buildLogsDirectory: string;
  env: Env;
}): Promise<void> {
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
