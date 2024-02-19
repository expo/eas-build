import path from 'path';

import { BuildStaticContext, Env, Job, Metadata } from '@expo/eas-build-job';
import { bunyan, createLogger } from '@expo/logger';

import { BuildConfigParser } from '../BuildConfigParser.js';
import { BuildRuntimePlatform } from '../BuildRuntimePlatform.js';
import { BuildStepGlobalContext, ExternalBuildContextProvider } from '../BuildStepContext.js';
import { BuildStepEnv } from '../BuildStepEnv.js';
import { BuildWorkflowError } from '../errors.js';

const logger = createLogger({
  name: 'steps-cli',
  level: 'info',
});

export class CliContextProvider implements ExternalBuildContextProvider {
  private _env: BuildStepEnv = {};

  constructor(
    public readonly logger: bunyan,
    public readonly runtimePlatform: BuildRuntimePlatform,
    public readonly projectSourceDirectory: string,
    public readonly projectTargetDirectory: string,
    public readonly defaultWorkingDirectory: string,
    public readonly buildLogsDirectory: string,
    public readonly buildDirectory: string,
    public readonly projectRootDirectory: string
  ) {}
  public get env(): BuildStepEnv {
    return this._env;
  }
  public staticContext(): BuildStaticContext {
    return {
      job: {} as Job,
      metadata: {} as Metadata,
      env: this.env as Env,
    };
  }
  public updateEnv(env: BuildStepEnv): void {
    this._env = env;
  }
}

async function runAsync(
  configPath: string,
  relativeProjectDirectory: string,
  runtimePlatform: BuildRuntimePlatform
): Promise<void> {
  const ctx = new BuildStepGlobalContext(
    new CliContextProvider(
      logger,
      runtimePlatform,
      relativeProjectDirectory,
      relativeProjectDirectory,
      relativeProjectDirectory,
      relativeProjectDirectory,
      relativeProjectDirectory,
      relativeProjectDirectory
    ),
    false
  );
  const parser = new BuildConfigParser(ctx, {
    configPath,
  });
  const workflow = await parser.parseAsync();
  await workflow.executeAsync();
}

const relativeConfigPath = process.argv[2];
const relativeProjectDirectoryPath = process.argv[3];
const platform: BuildRuntimePlatform = (process.argv[4] ??
  process.platform) as BuildRuntimePlatform;

if (!relativeConfigPath || !relativeProjectDirectoryPath) {
  console.error('Usage: yarn cli config.yml path/to/project/directory [darwin|linux]');
  process.exit(1);
}

const configPath = path.resolve(process.cwd(), relativeConfigPath);
const workingDirectory = path.resolve(process.cwd(), relativeProjectDirectoryPath);

runAsync(configPath, workingDirectory, platform).catch((err) => {
  logger.error({ err }, 'Build failed');
  if (err instanceof BuildWorkflowError) {
    logger.error('Failed to parse the custom build config file.');
    for (const detailedErr of err.errors) {
      logger.error({ err: detailedErr });
    }
  }
});
