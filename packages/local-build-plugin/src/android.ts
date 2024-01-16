import { Android, ManagedArtifactType, BuildPhase, Env } from '@expo/eas-build-job';
import { Builders, BuildContext, Artifacts } from '@expo/build-tools';
import omit from 'lodash/omit';

import logger, { logBuffer } from './logger';
import { BuildParams } from './types';
import { prepareArtifacts } from './artifacts';
import config from './config';
import { runGlobalExpoCliCommandAsync } from './expoCli';

export async function buildAndroidAsync(
  job: Android.Job,
  { workingdir, env: baseEnv, metadata }: BuildParams
): Promise<Artifacts> {
  const versionName = job.version?.versionName;
  const versionCode = job.version?.versionCode;
  const env: Env = {
    ...baseEnv,
    ...(versionCode && { EAS_BUILD_ANDROID_VERSION_CODE: versionCode }),
    ...(versionName && { EAS_BUILD_ANDROID_VERSION_NAME: versionName }),
  };
  const ctx = new BuildContext<Android.Job>(job, {
    workingdir,
    logger,
    logBuffer,
    runGlobalExpoCliCommand: runGlobalExpoCliCommandAsync,
    uploadArtifact: async ({ artifact, logger }) => {
      if (artifact.type !== ManagedArtifactType.APPLICATION_ARCHIVE) {
        return null;
      } else {
        return await prepareArtifacts(artifact.paths, logger);
      }
    },
    env,
    metadata,
    skipNativeBuild: config.skipNativeBuild,
  });

  await ctx.runBuildPhase(BuildPhase.START_BUILD, async () => {
    ctx.logger.info({ job: omit(ctx.job, 'secrets') }, 'Starting build');
  });

  return await Builders.androidBuilder(ctx);
}
