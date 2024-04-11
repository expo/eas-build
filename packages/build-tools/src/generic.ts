import fs from 'fs';
import path from 'path';

import { BuildPhase, Generic } from '@expo/eas-build-job';
import { BuildConfigParser, BuildStepGlobalContext, errors } from '@expo/steps';
import nullthrows from 'nullthrows';

import { BuildContext } from './context';
import { prepareProjectSourcesAsync } from './common/projectSources';
import { getEasFunctions } from './steps/easFunctions';
import { CustomBuildContext } from './customBuildContext';
import { getEasFunctionGroups } from './steps/easFunctionGroups';

export async function runGenericJobAsync(ctx: BuildContext<Generic.Job>): Promise<void> {
  const customBuildCtx = new CustomBuildContext(ctx);

  await prepareProjectSourcesAsync(ctx, customBuildCtx.projectSourceDirectory);

  await addEasWorkflows(customBuildCtx);

  const relativeConfigPath = nullthrows(
    ctx.job.customBuildConfig?.path,
    'Missing job definition file path.'
  );
  const configPath = path.join(customBuildCtx.projectSourceDirectory, relativeConfigPath);

  const globalContext = new BuildStepGlobalContext(customBuildCtx, false);

  const parser = new BuildConfigParser(globalContext, {
    externalFunctions: getEasFunctions(customBuildCtx),
    externalFunctionGroups: getEasFunctionGroups(customBuildCtx),
    configPath,
  });

  const workflow = await ctx.runBuildPhase(BuildPhase.PARSE_CUSTOM_WORKFLOW_CONFIG, async () => {
    try {
      return await parser.parseAsync();
    } catch (parseError: any) {
      ctx.logger.error('Failed to parse the job definition file.');
      if (parseError instanceof errors.BuildWorkflowError) {
        for (const err of parseError.errors) {
          ctx.logger.error({ err });
        }
      }
      throw parseError;
    }
  });

  await workflow.executeAsync();
}

async function addEasWorkflows(customBuildCtx: CustomBuildContext): Promise<void> {
  const originalRequireExtensionsYml = require.extensions['.yml'];
  try {
    require.extensions['.yml'] = function (module, filename) {
      const fs = require('fs');
      const yamlContent = fs.readFileSync(filename, 'utf8');
      module.exports = yamlContent;
    };

    const WORKFLOW_FILE_PATHS = ['../resources/update-in-the-cloud.yml'];
    await fs.promises.mkdir(path.join(customBuildCtx.projectSourceDirectory, '__eas'), {
      recursive: true,
    });
    for (const workflowFilePath of WORKFLOW_FILE_PATHS) {
      const workflowString = require(workflowFilePath);
      await fs.promises.writeFile(
        path.join(customBuildCtx.projectSourceDirectory, '__eas', 'update-in-the-cloud.yml'),
        workflowString
      );
    }
  } finally {
    require.extensions['.yml'] = originalRequireExtensionsYml;
  }
}
