import path from 'path';

import { BuildPhase, Job } from '@expo/eas-build-job';
import { BuildConfigParser, BuildStepContext } from '@expo/steps';
import nullthrows from 'nullthrows';

import { Artifacts, BuildContext } from '../context';
import { prepareProjectSourcesAsync } from '../common/projectSources';

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
  const parser = new BuildConfigParser(buildStepContext, { configPath });
  const workflow = await parser.parseAsync();
  await workflow.executeAsync();

  // TOOD: return application archive and build artifacts
  return {};
}
