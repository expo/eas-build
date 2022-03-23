import { Ios, BuildPhase } from '@expo/eas-build-job';
import { Builders, BuildContext } from '@expo/build-tools';
import omit from 'lodash/omit';

import { runExpoCliCommandAsync } from './expoCli';
import logger, { logBuffer } from './logger';
import { BuildParams } from './types';
import { prepareBuildArtifact } from './buildArtifact';
import config from './config';

export async function buildIosAsync(
  job: Ios.Job,
  { workingdir, env }: BuildParams
): Promise<string | undefined> {
  const ctx = new BuildContext<Ios.Job>(job, {
    workingdir,
    logger,
    logBuffer,
    runExpoCliCommand: runExpoCliCommandAsync,
    env,
    skipNativeBuild: config.skipNativeBuild,
  });

  await ctx.runBuildPhase(BuildPhase.START_BUILD, async () => {
    ctx.logger.info({ job: omit(ctx.job, 'secrets') }, 'Starting build');
  });

  const artifactPaths = await Builders.iosBuilder(ctx);

  return await prepareBuildArtifact(ctx, artifactPaths);
}
