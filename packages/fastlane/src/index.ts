import { bunyan } from '@expo/logger';
import spawn, { SpawnResult } from '@expo/turtle-spawn';

interface FastlaneOptions {
  logger?: bunyan;
  envs?: { [key: string]: string | undefined };
  cwd?: string;
}

interface FastlaneResult {
  err?: Error;
  stdout: string;
  stderr: string;
}

async function runFastlane(
  fastlaneArgs: string[],
  { logger, envs, cwd }: FastlaneOptions = {}
): Promise<SpawnResult> {
  const fastlaneEnvVars = {
    FASTLANE_DISABLE_COLORS: '1',
    FASTLANE_SKIP_UPDATE_CHECK: '1',
    SKIP_SLOW_FASTLANE_WARNING: 'true',
    FASTLANE_HIDE_TIMESTAMP: 'true',
    CI: '1',
    LC_ALL: 'en_US.UTF-8',
    ...envs,
  };
  return await spawn('fastlane', fastlaneArgs, {
    env: { ...process.env, ...fastlaneEnvVars },
    logger,
    cwd,
  });
}

async function runFastlaneSafely(
  fastlaneArgs: string[],
  options?: FastlaneOptions
): Promise<FastlaneResult> {
  try {
    const { stdout, stderr } = await runFastlane(fastlaneArgs, options);
    return { stdout, stderr };
  } catch (err) {
    const { stdout, stderr } = err;
    return { stdout, stderr, err };
  }
}

export default runFastlane;
export { runFastlaneSafely };
