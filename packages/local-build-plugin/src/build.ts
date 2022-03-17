import { Job, Platform, ArchiveSourceType } from '@expo/eas-build-job';
import pickBy from 'lodash/pickBy';
import fs from 'fs-extra';
import chalk from 'chalk';
import { SkipNativeBuildError } from '@expo/build-tools';

import { buildAndroidAsync } from './android';
import config from './config';
import { buildIosAsync } from './ios';
import { prepareWorkingdirAsync } from './workingdir';

export async function buildAsync(job: Job): Promise<void> {
  const workingdir = await prepareWorkingdirAsync();

  try {
    const env = {
      ...pickBy(process.env, (val?: string): val is string => !!val),
      ...job.builderEnvironment?.env,
      EAS_BUILD: '1',
    };
    let artifactPath: string | undefined;
    switch (job.platform) {
      case Platform.ANDROID: {
        artifactPath = await buildAndroidAsync(job, { env, workingdir });
        break;
      }
      case Platform.IOS: {
        artifactPath = await buildIosAsync(job, { env, workingdir });
        break;
      }
    }
    if (!config.skipNativeBuild) {
      console.log();
      console.log(chalk.green('Build successful'));
      console.log(chalk.green(`You can find the build artifacts in ${artifactPath}`));
    }
  } catch (e: any) {
    if (e instanceof SkipNativeBuildError) {
      console.log(e.message);
      return;
    }
    console.error();
    console.error(chalk.red(`Build failed`));
    if (config.logger.level === 'debug') {
      console.error(e.innerError);
    }
    throw e;
  } finally {
    if (!config.skipCleanup) {
      await fs.remove(workingdir);
    } else {
      console.error(chalk.yellow(`Skipping cleanup, ${workingdir} won't be removed.`));
    }
    if (job.projectArchive.type === ArchiveSourceType.PATH) {
      await fs.remove(job.projectArchive.path);
    }
  }
}
