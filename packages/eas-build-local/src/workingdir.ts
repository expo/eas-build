import path from 'path';

import envPaths from 'env-paths';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

import logger from './logger';
import { registerHandler } from './exit';

const { temp } = envPaths('eas-build-local');

export async function prepareWorkingdirAsync(): Promise<string> {
  const workingdir = path.join(temp, uuidv4());
  logger.info({ phase: 'SETUP_WORKINGDIR' }, `Preparing workingdir ${workingdir}`);

  await fs.remove(workingdir);
  await fs.mkdirp(path.join(workingdir, 'artifacts'));
  await fs.mkdirp(path.join(workingdir, 'build'));
  registerHandler(async () => {
    await fs.remove(workingdir);
  });
  return workingdir;
}
