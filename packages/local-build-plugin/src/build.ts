import { Job, Platform, ArchiveSourceType } from '@expo/eas-build-job';
import pickBy from 'lodash/pickBy';
import fs from 'fs-extra';
import chalk from 'chalk';

import { buildAndroidAsync } from './android';
import config from './config';
import { buildIosAsync } from './ios';
import { prepareWorkingdirAsync } from './workingdir';

export async function buildAsync(job: Job): Promise<void> {
  const workingdir = await prepareWorkingdirAsync();

  try {
    const env = pickBy(process.env, (val?: string): val is string => !!val);
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
    console.log();
    console.log(chalk.green('Build successful'));
    console.log(chalk.green(`Build results were copied to ${artifactPath}`));
  } catch (e) {
    console.error();
    console.error(chalk.red(`Build failed`));
    throw e;
  } finally {
    if (!config.skipCleanup) {
      await fs.remove(workingdir);
    } else {
      console.error(
        chalk.yellow("EAS_LOCAL_BUILD_SKIP_CLEANUP is set, working dir won't be removed.")
      );
    }
    if (job.projectArchive.type === ArchiveSourceType.PATH) {
      await fs.remove(job.projectArchive.path);
    }
  }
}
