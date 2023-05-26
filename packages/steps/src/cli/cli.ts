import path from 'path';

import { createLogger } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';

import { BuildConfigParser } from '../BuildConfigParser.js';
import { BuildStepContext } from '../BuildStepContext.js';
import { BuildWorkflowError } from '../errors.js';
import { BuildRuntimePlatform } from '../BuildRuntimePlatform.js';

const logger = createLogger({
  name: 'steps-cli',
  level: 'info',
});

async function runAsync(
  configPath: string,
  relativeProjectDirectory: string,
  runtimePlatform: BuildRuntimePlatform
): Promise<void> {
  const fakeBuildId = uuidv4();
  const ctx = new BuildStepContext(
    fakeBuildId,
    logger,
    false,
    runtimePlatform,
    relativeProjectDirectory,
    relativeProjectDirectory,
    relativeProjectDirectory
  );
  const parser = new BuildConfigParser(ctx, { configPath });
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
