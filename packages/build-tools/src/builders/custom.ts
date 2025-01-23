import assert from 'assert';
import path from 'path';

import nullthrows from 'nullthrows';
import { BuildJob, BuildPhase, BuildTrigger, Ios, Platform } from '@expo/eas-build-job';
import { BuildConfigParser, BuildStepGlobalContext, StepsConfigParser, errors } from '@expo/steps';

import { Artifacts, BuildContext } from '../context';
import { prepareProjectSourcesAsync } from '../common/projectSources';
import { getEasFunctions } from '../steps/easFunctions';
import { CustomBuildContext } from '../customBuildContext';
import { resolveEnvFromBuildProfileAsync } from '../common/easBuildInternal';
import { getEasFunctionGroups } from '../steps/easFunctionGroups';
import { findAndUploadXcodeBuildLogsAsync } from '../ios/xcodeBuildLogs';
import { addEasWorkflows } from '../generic';

export async function runCustomBuildAsync(ctx: BuildContext<BuildJob>): Promise<Artifacts> {
  const customBuildCtx = new CustomBuildContext(ctx);
  await addEasWorkflows(customBuildCtx);
  await prepareProjectSourcesAsync(ctx, customBuildCtx.projectSourceDirectory);
  if (ctx.job.triggeredBy === BuildTrigger.GIT_BASED_INTEGRATION) {
    // We need to setup envs from eas.json
    const env = await resolveEnvFromBuildProfileAsync(ctx, {
      cwd: path.join(customBuildCtx.projectSourceDirectory, ctx.job.projectRootDirectory ?? '.'),
    });
    ctx.updateEnv(env);
    customBuildCtx.updateEnv(ctx.env);
  }

  assert(
    'steps' in ctx.job || 'customBuildConfig' in ctx.job,
    'Steps or custom build config path are required in custom jobs'
  );

  const globalContext = new BuildStepGlobalContext(customBuildCtx, false);
  const easFunctions = getEasFunctions(customBuildCtx);
  const easFunctionGroups = getEasFunctionGroups(customBuildCtx);
  const parser = ctx.job.steps
    ? new StepsConfigParser(globalContext, {
        externalFunctions: easFunctions,
        externalFunctionGroups: easFunctionGroups,
        steps: ctx.job.steps,
      })
    : new BuildConfigParser(globalContext, {
        externalFunctions: easFunctions,
        externalFunctionGroups: easFunctionGroups,
        configPath: path.join(
          ctx.getReactNativeProjectDirectory(customBuildCtx.projectSourceDirectory),
          nullthrows(
            ctx.job.customBuildConfig?.path,
            'Steps or custom build config path are required in custom jobs'
          )
        ),
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

    if (!ctx.artifacts.XCODE_BUILD_LOGS && ctx.job.platform === Platform.IOS) {
      try {
        await findAndUploadXcodeBuildLogsAsync(ctx as BuildContext<Ios.Job>, {
          logger: ctx.logger,
          runStatus: 'success',
        });
      } catch {
        // do nothing, it's a non-breaking error.
      }
    }
  } catch (err: any) {
    if (!ctx.artifacts.XCODE_BUILD_LOGS && ctx.job.platform === Platform.IOS) {
      try {
        await findAndUploadXcodeBuildLogsAsync(ctx as BuildContext<Ios.Job>, {
          logger: ctx.logger,
          runStatus: 'errored',
        });
      } catch {
        // do nothing, it's a non-breaking error.
      }
    }
    err.artifacts = ctx.artifacts;
    throw err;
  }

  return ctx.artifacts;
}
