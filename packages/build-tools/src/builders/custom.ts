import path from 'path';

import { BuildPhase, Job, Platform } from '@expo/eas-build-job';
import { BuildConfigParser, BuildStepContext, errors, BuildRuntimePlatform } from '@expo/steps';
import nullthrows from 'nullthrows';

import { Artifacts, BuildContext } from '../context';
import { prepareProjectSourcesAsync } from '../common/projectSources';
import { getEasFunctions } from '../steps/easFunctions';

const platformToBuildRuntimePlatform: Record<Platform, BuildRuntimePlatform> = {
  [Platform.ANDROID]: BuildRuntimePlatform.LINUX,
  [Platform.IOS]: BuildRuntimePlatform.DARWIN,
};

export async function runCustomBuildAsync<T extends Job>(ctx: BuildContext<T>): Promise<Artifacts> {
  await prepareProjectSourcesAsync(ctx, ctx.temporaryCustomBuildDirectory);
  const relativeConfigPath = nullthrows(
    ctx.job.customBuildConfig?.path,
    'Custom build config must be defined for custom builds'
  );
  const configPath = path.join(ctx.getReactNativeProjectDirectory(), relativeConfigPath);

  const buildStepContext = new BuildStepContext(
    ctx.env.EAS_BUILD_ID,
    ctx.logger.child({ phase: BuildPhase.CUSTOM }),
    false,
    platformToBuildRuntimePlatform[ctx.job.platform],
    ctx.temporaryCustomBuildDirectory,
    ctx.buildDirectory
  );
  const easFunctions = getEasFunctions(ctx);
  const parser = new BuildConfigParser(buildStepContext, {
    configPath,
    externalFunctions: easFunctions,
  });
  const workflow = await ctx.runBuildPhase(BuildPhase.PARSE_CUSTOM_WORKFLOW_CONFIG, async () => {
    try {
      return await parser.parseAsync();
    } catch (parseError: any) {
      ctx.logger.error('Failed to parse the custom build config file.');
      if (parseError instanceof errors.BuildWorkflowError) {
        for (const err of parseError.errors) {
          ctx.logger.error({ err });
        }
      }
      throw parseError;
    }
  });
  try {
    await workflow.executeAsync(ctx.env);
  } catch (err: any) {
    err.artifacts = ctx.artifacts;
    throw err;
  }

  return ctx.artifacts;
}
