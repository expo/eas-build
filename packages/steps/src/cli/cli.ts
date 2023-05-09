import path from 'path';

import { createLogger } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';
import { Platform } from '@expo/eas-build-job';

import { BuildConfigParser } from '../BuildConfigParser.js';
import { BuildStepContext } from '../BuildStepContext.js';
import { BuildWorkflowError } from '../errors.js';

const logger = createLogger({
  name: 'steps-cli',
  level: 'info',
});

async function runAsync(
  configPath: string,
  workingDirectory: string,
  platform: Platform
): Promise<void> {
  const fakeBuildId = uuidv4();
  const ctx = new BuildStepContext(fakeBuildId, logger, false, { workingDirectory });
  const parser = new BuildConfigParser(ctx, { configPath });
  const workflow = await parser.parseAsync(platform);
  await workflow.executeAsync();
}

const relativeConfigPath = process.argv[2];
const relativeWorkingDirectoryPath = process.argv[3];
const platform: Platform = process.argv[4] as Platform;

if (!relativeConfigPath || !relativeWorkingDirectoryPath || !platform) {
  console.error('Usage: yarn cli config.yml path/to/working/directory ios|android');
  process.exit(1);
}

const configPath = path.resolve(process.cwd(), relativeConfigPath);
const workingDirectory = path.resolve(process.cwd(), relativeWorkingDirectoryPath);

runAsync(configPath, workingDirectory, platform).catch((err) => {
  logger.error({ err }, 'Build failed');
  if (err instanceof BuildWorkflowError) {
    logger.error('Failed to parse the custom build config file.');
    for (const detailedErr of err.errors) {
      logger.error({ err: detailedErr });
    }
  }
});
