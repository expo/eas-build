import path from 'path';

import { BuildPhase, BuildTrigger, Job } from '@expo/eas-build-job';
import { BuildConfigParser, BuildStepGlobalContext, errors } from '@expo/steps';
import nullthrows from 'nullthrows';

import { Artifacts, BuildContext } from '../context';
import { prepareProjectSourcesAsync } from '../common/projectSources';
import { getEasFunctions } from '../steps/easFunctions';
import { CustomBuildContext } from '../customBuildContext';
import { resolveEnvFromBuildProfileAsync } from '../common/easBuildInternal';
import { getEasFunctionGroups } from '../steps/easFunctionGroups';

export async function runCustomBuildAsync<T extends Job>(ctx: BuildContext<T>): Promise<Artifacts> {
  const customBuildCtx = new CustomBuildContext(ctx);
  await prepareProjectSourcesAsync(ctx, customBuildCtx.projectSourceDirectory);
  if (ctx.job.triggeredBy === BuildTrigger.GIT_BASED_INTEGRATION) {
    // We need to setup envs from eas.json
    const env = await resolveEnvFromBuildProfileAsync(ctx, {
      cwd: customBuildCtx.projectSourceDirectory,
    });
    ctx.updateEnv(env);
    customBuildCtx.updateEnv(ctx.env);
  }
  const relativeConfigPath = nullthrows(
    ctx.job.customBuildConfig?.path,
    'Custom build config must be defined for custom builds'
  );
  const configPath = path.join(
    ctx.getReactNativeProjectDirectory(customBuildCtx.projectSourceDirectory),
    relativeConfigPath
  );

  const globalContext = new BuildStepGlobalContext(customBuildCtx, false);
  const easFunctions = getEasFunctions(customBuildCtx);
  const easFunctionGroups = getEasFunctionGroups(customBuildCtx);
  const parser = new BuildConfigParser(globalContext, {
    externalFunctions: easFunctions,
    externalFunctionGroups: easFunctionGroups,
    configPath,
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
    await workflow.executeAsync();
  } catch (err: any) {
    err.artifacts = ctx.artifacts;
    throw err;
  }

  return ctx.artifacts;
}
