import { Ios, BuildPhase, Env } from '@expo/eas-build-job';
import { Builders, BuildContext, ArtifactType, Artifacts } from '@expo/build-tools';
import { bunyan } from '@expo/logger';
import omit from 'lodash/omit';

import { runGlobalExpoCliCommandAsync } from './expoCli';
import logger, { logBuffer } from './logger';
import { BuildParams } from './types';
import { prepareArtifacts } from './artifacts';
import config from './config';

export async function buildIosAsync(
  job: Ios.Job,
  { workingdir, env: baseEnv, metadata }: BuildParams
): Promise<Artifacts> {
  const buildNumber = job.version?.buildNumber;
  const appVersion = job.version?.appVersion;
  const env: Env = {
    ...baseEnv,
    ...(buildNumber && { EAS_BUILD_IOS_BUILD_NUMBER: buildNumber }),
    ...(appVersion && { EAS_BUILD_IOS_APP_VERSION: appVersion }),
  };
  const ctx = new BuildContext<Ios.Job>(job, {
    workingdir,
    logger,
    logBuffer,
    runGlobalExpoCliCommand: runGlobalExpoCliCommandAsync,
    uploadArtifacts: async (type: ArtifactType, paths: string[], logger?: bunyan) => {
      if (type !== ArtifactType.APPLICATION_ARCHIVE) {
        return null;
      } else {
        return await prepareArtifacts(paths, logger);
      }
    },
    env,
    metadata,
    skipNativeBuild: config.skipNativeBuild,
  });

  await ctx.runBuildPhase(BuildPhase.START_BUILD, async () => {
    ctx.logger.info({ job: omit(ctx.job, 'secrets') }, 'Starting build');
  });

  return await Builders.iosBuilder(ctx);
}
