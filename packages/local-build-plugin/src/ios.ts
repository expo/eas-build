import { Ios, BuildPhase, Env } from '@expo/eas-build-job';
import { Builders, BuildContext } from '@expo/build-tools';
import omit from 'lodash/omit';

import { runGlobalExpoCliCommandAsync } from './expoCli';
import logger, { logBuffer } from './logger';
import { BuildParams } from './types';
import { prepareBuildArtifact } from './buildArtifact';
import config from './config';

export async function buildIosAsync(
  job: Ios.Job,
  { workingdir, env: baseEnv }: BuildParams
): Promise<string | undefined> {
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
    env,
    skipNativeBuild: config.skipNativeBuild,
  });

  await ctx.runBuildPhase(BuildPhase.START_BUILD, async () => {
    ctx.logger.info({ job: omit(ctx.job, 'secrets') }, 'Starting build');
  });

  const artifactPaths = await Builders.iosBuilder(ctx);

  return await prepareBuildArtifact(ctx, artifactPaths);
}
