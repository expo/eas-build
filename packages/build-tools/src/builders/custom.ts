import path from 'path';

import { BuildPhase, Job } from '@expo/eas-build-job';
import { BuildConfigParser, BuildStepContext } from '@expo/steps';
import nullthrows from 'nullthrows';

import { Artifacts, BuildContext } from '../context';
import { prepareProjectSourcesAsync } from '../common/projectSources';
import { getEasFunctions } from '../steps/easFunctions';

export async function runCustomBuildAsync<T extends Job>(ctx: BuildContext<T>): Promise<Artifacts> {
  await prepareProjectSourcesAsync(ctx);

  const relativeConfigPath = nullthrows(
    ctx.job.customBuildConfig?.path,
    'Custom build config must be defined for custom builds'
  );
  const configPath = path.join(ctx.reactNativeProjectDirectory, relativeConfigPath);

  const buildStepContext = new BuildStepContext(
    ctx.env.EAS_BUILD_ID,
    ctx.logger.child({ phase: BuildPhase.CUSTOM }),
    false,
    ctx.reactNativeProjectDirectory
  );
  const easFunctions = getEasFunctions(ctx);
  const parser = new BuildConfigParser(buildStepContext, {
    configPath,
    externalFunctions: easFunctions,
  });
  const workflow = await parser.parseAsync();
  try {
    try {
      await workflow.executeAsync(ctx.env);
    } finally {
      try {
        await workflow.cleanUpAsync();
      } catch (err: any) {
        ctx.logger.error({ err }, 'Failed to clean up custom build temporary files');
      }
    }
  } catch (err: any) {
    err.artifacts = ctx.artifacts;
    throw err;
  }

  return ctx.artifacts;
}
