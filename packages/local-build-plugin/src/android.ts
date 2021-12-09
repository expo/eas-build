import { Android, BuildPhase } from '@expo/eas-build-job';
import { Builders, BuildContext } from '@expo/build-tools';
import omit from 'lodash/omit';

import { LocalExpoCliEjectProvider } from './eject';
import logger, { logBuffer } from './logger';
import { BuildParams } from './types';
import { prepareBuildArtifact } from './buildArtifact';
import config from './config';

export async function buildAndroidAsync(
  job: Android.Job,
  { workingdir, env }: BuildParams
): Promise<string | undefined> {
  const ctx = new BuildContext<Android.Job>(job, {
    workingdir,
    logger,
    logBuffer,
    ejectProvider: new LocalExpoCliEjectProvider(),
    env,
    skipNativeBuild: config.skipNativeBuild,
  });

  await ctx.runBuildPhase(BuildPhase.START_BUILD, async () => {
    ctx.logger.info({ job: omit(ctx.job, 'secrets') }, 'Starting build');
  });

  const artifactPaths = await Builders.androidBuilder(ctx);

  return await prepareBuildArtifact(ctx, artifactPaths);
}
