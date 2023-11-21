import { getConfig, ProjectConfig } from '@expo/config';
import { Env } from '@expo/eas-build-job';
import { bunyan, LoggerLevel } from '@expo/logger';
import { load } from '@expo/env';
import semver from 'semver';

export function readAppConfig({
  projectDir,
  env,
  logger,
  sdkVersion,
}: {
  projectDir: string;
  env: Env;
  logger: bunyan;
  sdkVersion?: string;
}): ProjectConfig {
  const originalProcessExit = process.exit;
  const originalProcessCwd = process.cwd;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  const stdoutStore: { text: string; level: LoggerLevel }[] = [];
  const shouldLoadEnvVarsFromDotenvFile = sdkVersion && semver.satisfies(sdkVersion, '>=49');
  const envVarsFromDotenvFile = shouldLoadEnvVarsFromDotenvFile ? load(projectDir) : {};
  const newEnvsToUse = { ...envVarsFromDotenvFile, ...env };
  try {
    for (const [key, value] of Object.entries(newEnvsToUse)) {
      process.env[key] = value;
    }
    process.exit = () => {
      throw new Error('Failed to evaluate app config file');
    };
    process.cwd = () => projectDir;
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
    for (const [key] of Object.entries(newEnvsToUse)) {
      delete process.env[key];
    }
    process.exit = originalProcessExit;
    process.cwd = originalProcessCwd;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}
