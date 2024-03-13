import { BuildTrigger } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import { BuildFunction, BuildStepEnv } from '@expo/steps';
import { omit } from 'lodash';

import { runEasBuildInternalAsync } from '../../common/easBuildInternal';
import { CustomBuildContext } from '../../customBuildContext';

export function createResolveBuildConfigBuildFunction(ctx: CustomBuildContext): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'resolve_build_config',
    name: 'Resolve build config',
    fn: async ({ logger, workingDirectory }, { env }) => {
      await resolveBuildConfigAsync({ logger, workingDirectory, env, ctx });
    },
  });
}

export async function resolveBuildConfigAsync({
  logger,
  workingDirectory,
  env,
  ctx,
}: {
  logger: bunyan;
  workingDirectory: string;
  env: BuildStepEnv;
  ctx: CustomBuildContext;
}): Promise<void> {
  if (ctx.job.triggeredBy === BuildTrigger.GIT_BASED_INTEGRATION) {
    logger.info('Resolving build config...');
    const { newJob, newMetadata } = await runEasBuildInternalAsync({
      job: ctx.job,
      env,
      logger,
      cwd: workingDirectory,
    });
    ctx.updateJobInformation(newJob, newMetadata);
  }

  logger.info('Build config resolved:');
  logger.info(
    JSON.stringify(
      { job: omit(ctx.job, 'secrets', 'projectArchive'), metadata: ctx.metadata },
      null,
      2
    )
  );
}
