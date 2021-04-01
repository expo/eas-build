import { Job, Platform, ArchiveSourceType } from '@expo/eas-build-job';
import pickBy from 'lodash/pickBy';
import fs from 'fs-extra';

import { buildAndroidAsync } from './android';
import { buildIosAsync } from './ios';
import logger from './logger';
import { prepareWorkingdirAsync } from './workingdir';

export async function buildAsync(job: Job): Promise<void> {
  const workingdir = await prepareWorkingdirAsync();

  try {
    const env = pickBy(process.env, (val?: string): val is string => !!val);
    let artifactUrl: string | undefined;
    switch (job.platform) {
      case Platform.ANDROID: {
        artifactUrl = await buildAndroidAsync(job, { env, workingdir });
        break;
      }
      case Platform.IOS: {
        artifactUrl = await buildIosAsync(job, { env, workingdir });
        break;
      }
    }
    console.log(artifactUrl);
  } catch (e) {
    logger.error({ phase: 'BUILD_ERROR' }, `Build failed at ${workingdir}`);
    throw e;
  } finally {
    await fs.remove(workingdir);
    if (job.projectArchive.type === ArchiveSourceType.PATH) {
      await fs.remove(job.projectArchive.path);
    }
  }
  logger.info({ phase: 'BUILD_SUCCESS' }, `Build successful at ${workingdir}`);
}
