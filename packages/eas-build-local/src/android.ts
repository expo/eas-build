import { Android, BuildPhase, Workflow } from '@expo/eas-build-job';
import { Builders, BuildContext, ManagedBuildContext } from '@expo/build-tools';
import omit from 'lodash/omit';

import { LocalExpoCliEjectProvider } from './eject';
import logger, { logBuffer } from './logger';
import { BuildParams } from './types';

export async function buildAndroidAsync(
  job: Android.Job,
  buildParams: BuildParams
): Promise<string | undefined> {
  const ctx = createBuildContext(job, buildParams);

  await ctx.runBuildPhase(BuildPhase.START_BUILD, async () => {
    ctx.logger.info({ job: omit(ctx.job, 'secrets') }, 'Starting build');
  });

  const artifactPaths = await build(ctx);

  return artifactPaths[0];
}

function createBuildContext(
  job: Android.Job,
  { env, workingdir }: BuildParams
): BuildContext<Android.Job> {
  if (job.type === Workflow.GENERIC) {
    return new BuildContext(job, {
      workingdir,
      logger,
      logBuffer,
      env,
    });
  } else {
    return new ManagedBuildContext<Android.ManagedJob>(job, {
      workingdir,
      logger,
      logBuffer,
      ejectProvider: new LocalExpoCliEjectProvider(),
      env,
    });
  }
}

async function build(ctx: BuildContext<Android.Job>): Promise<string[]> {
  if (ctx.job.type === Workflow.GENERIC) {
    return await Builders.androidGenericBuilder(ctx as BuildContext<Android.GenericJob>);
  } else {
    return await Builders.androidManagedBuilder(ctx as ManagedBuildContext<Android.ManagedJob>);
  }
}
