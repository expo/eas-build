import path from 'path';

import { Job } from '@expo/eas-build-job';
import fs from 'fs-extra';

import { BuildContext } from '../context';

import { findPackagerRootDir } from './packageManager';

const NPMRC_TEMPLATE_PATH = path.join(__dirname, '../../templates/npmrc');

export async function createNpmrcIfNotExistsAsync(ctx: BuildContext<Job>): Promise<void> {
  ctx.logger.info('We detected that you set the NPM_TOKEN environment variable');
  const projectNpmrcPath = path.join(ctx.buildDirectory, '.npmrc');
  if (await fs.pathExists(projectNpmrcPath)) {
    ctx.logger.info('.npmrc already exists in your project directory, skipping generation');
  } else {
    const npmrcContents = await fs.readFile(NPMRC_TEMPLATE_PATH, 'utf8');
    ctx.logger.info('Creating .npmrc in your project directory with the following contents:');
    ctx.logger.info(npmrcContents);
    await fs.copy(NPMRC_TEMPLATE_PATH, projectNpmrcPath);
  }
}

export async function logIfNpmrcExistsAsync(ctx: BuildContext<Job>): Promise<void> {
  const projectNpmrcPath = path.join(
    findPackagerRootDir(ctx.reactNativeProjectDirectory),
    '.npmrc'
  );
  if (await fs.pathExists(projectNpmrcPath)) {
    ctx.logger.info(`.npmrc found at ${path.relative(ctx.buildDirectory, projectNpmrcPath)}`);
  }
}
