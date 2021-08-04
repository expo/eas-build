import { getConfig, ProjectConfig } from '@expo/config';
import { Env } from '@expo/eas-build-job';
import { bunyan, LoggerLevel } from '@expo/logger';

export function readAppConfig(projectDir: string, env: Env, logger: bunyan): ProjectConfig {
  const originalProcessEnv: NodeJS.ProcessEnv = process.env;
  const originalProcessExit = process.exit;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  const stdoutStore: { text: string; level: LoggerLevel }[] = [];
  try {
    process.env = { ...env };
    process.exit = () => {
      throw new Error('Failed to evaluate app config file');
    };
    process.stdout.write = function (...args: any) {
      stdoutStore.push({ text: String(args[0]), level: LoggerLevel.INFO });
      return originalStdoutWrite.apply(process.stdout, args);
    };
    process.stderr.write = function (...args: any) {
      stdoutStore.push({ text: String(args[0]), level: LoggerLevel.ERROR });
      return originalStderrWrite.apply(process.stderr, args);
    };
    return getConfig(projectDir, {
      skipSDKVersionRequirement: true,
      isPublicConfig: true,
    });
  } catch (err) {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    stdoutStore.forEach(({ text, level }) => {
      logger[level](text.trim());
    });
    throw err;
  } finally {
    process.env = originalProcessEnv;
    process.exit = originalProcessExit;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}
