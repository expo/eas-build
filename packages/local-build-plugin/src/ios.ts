import { Ios, BuildPhase, Workflow } from '@expo/eas-build-job';
import { Builders, BuildContext, ManagedBuildContext } from '@expo/build-tools';
import omit from 'lodash/omit';

import { LocalExpoCliEjectProvider } from './eject';
import logger, { logBuffer } from './logger';
import { BuildParams } from './types';
import { prepareBuildArtifact } from './buildArtifact';

export async function buildIosAsync(
  job: Ios.Job,
  buildParams: BuildParams
): Promise<string | undefined> {
  const ctx = createBuildContext(job, buildParams);

  await ctx.runBuildPhase(BuildPhase.START_BUILD, async () => {
    ctx.logger.info({ job: omit(ctx.job, 'secrets') }, 'Starting build');
  });

  const artifactPaths = await build(ctx);

  return await prepareBuildArtifact(ctx, artifactPaths);
}

function createBuildContext(job: Ios.Job, { env, workingdir }: BuildParams): BuildContext<Ios.Job> {
  if (job.type === Workflow.GENERIC) {
    return new BuildContext(job, {
      workingdir,
      logger,
      logBuffer,
      env,
    });
  } else {
    console.log('creating managed build context');
    console.log('creating managed build context');
    console.log('creating managed build context');
    console.log('creating managed build context');
    console.log('creating managed build context');
    console.log('creating managed build context');
    return new ManagedBuildContext<Ios.ManagedJob>(job, {
      workingdir,
      logger,
      logBuffer,
      ejectProvider: new LocalExpoCliEjectProvider(),
      env,
    });
  }
}

async function build(ctx: BuildContext<Ios.Job>): Promise<string[]> {
  if (ctx.job.type === Workflow.GENERIC) {
    return await Builders.iosGenericBuilder(ctx as BuildContext<Ios.GenericJob>);
  } else {
    return await Builders.iosManagedBuilder(ctx as ManagedBuildContext<Ios.ManagedJob>);
  }
}
