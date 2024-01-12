import path from 'path';

import fs from 'fs-extra';
import { BuildFunction } from '@expo/steps';

import { findPackagerRootDir } from '../../utils/packageManager';

const NPMRC_TEMPLATE_PATH = path.join(__dirname, '../../templates/npmrc');

export function createSetUpNpmrcBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'use_npm_token',
    name: 'Use NPM_TOKEN',
    fn: async (stepCtx, { env }) => {
      const { logger } = stepCtx;
      if (env.NPM_TOKEN) {
        logger.info('We detected that you set the NPM_TOKEN environment variable');
        const projectNpmrcPath = path.join(stepCtx.global.projectTargetDirectory, '.npmrc');
        if (await fs.pathExists(projectNpmrcPath)) {
          logger.info('.npmrc already exists in your project directory, skipping generation');
        } else {
          const npmrcContents = await fs.readFile(NPMRC_TEMPLATE_PATH, 'utf8');
          logger.info('Creating .npmrc in your project directory with the following contents:');
          logger.info(npmrcContents);
          await fs.copy(NPMRC_TEMPLATE_PATH, projectNpmrcPath);
        }
      } else {
        const projectNpmrcPath = path.join(findPackagerRootDir(stepCtx.workingDirectory), '.npmrc');
        if (await fs.pathExists(projectNpmrcPath)) {
          logger.info(
            `.npmrc found at ${path.relative(
              stepCtx.global.projectTargetDirectory,
              projectNpmrcPath
            )}`
          );
        }
      }
    },
  });
}
