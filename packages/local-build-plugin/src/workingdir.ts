import path from 'path';

import chalk from 'chalk';
import fs from 'fs-extra';

import config from './config';
import logger from './logger';
import { registerHandler } from './exit';

export async function prepareWorkingdirAsync(): Promise<string> {
  const { workingdir } = config;
  logger.info({ phase: 'SETUP_WORKINGDIR' }, `Preparing workingdir ${workingdir}`);

  if ((await fs.pathExists(workingdir)) && (await fs.readdir(workingdir)).length > 0) {
    throw new Error('Workingdir is not empty.');
  }
  await fs.mkdirp(path.join(workingdir, 'artifacts'));
  await fs.mkdirp(path.join(workingdir, 'build'));
  registerHandler(async () => {
    if (!config.skipCleanup) {
      await fs.remove(workingdir);
    } else {
      console.error(
        chalk.yellow("EAS_LOCAL_BUILD_SKIP_CLEANUP is set, working dir won't be removed.")
      );
    }
  });
  return workingdir;
}
