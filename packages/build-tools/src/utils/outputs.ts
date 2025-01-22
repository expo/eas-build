import { Generic } from '@expo/eas-build-job';
import { BuildStep, jsepEval } from '@expo/steps';
import { bunyan } from '@expo/logger';
import nullthrows from 'nullthrows';

import { BuildContext } from '../context';

import { turtleFetch } from './turtleFetch';

export async function uploadJobOutputsToWwwAsync(
  ctx: BuildContext<Generic.Job>,
  {
    steps,
    logger,
    expoApiV2BaseUrl,
  }: { steps: BuildStep[]; logger: bunyan; expoApiV2BaseUrl: string }
): Promise<void> {
  if (!ctx.job.outputs) {
    logger.info('Job defines no outputs, skipping upload');
    return;
  }

  try {
    const workflowJobId = nullthrows(ctx.job.builderEnvironment?.env?.__WORKFLOW_JOB_ID);
    const robotAccessToken = nullthrows(ctx.job.secrets?.robotAccessToken);

    const interpolationContext = {
      steps: Object.fromEntries(steps.map((step) => [step.id, getStepOutputsAsObject(step)])),
    };
    logger.debug({ dynamicValues: interpolationContext }, 'Using dynamic values');

    const outputs = getJobOutputsFromSteps({
      jobOutputDefinitions: ctx.job.outputs,
      interpolationContext,
    });
    logger.info('Uploading outputs');

    await turtleFetch(new URL(`workflows/${workflowJobId}`, expoApiV2BaseUrl).toString(), 'PATCH', {
      json: { outputs },
      headers: {
        Authorization: `Bearer ${robotAccessToken}`,
      },
      timeout: 20000,
      logger,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to upload outputs');
    throw err;
  }
}

/** Function we use to get outputs of the whole job from steps. */
export function getJobOutputsFromSteps({
  jobOutputDefinitions,
  interpolationContext,
}: {
  jobOutputDefinitions: Record<string, string>;
  interpolationContext: {
    steps: Record<string, { outputs: Record<string, string | undefined> }>;
  };
}): Record<string, string | undefined> {
  const jobOutputs: Record<string, string | undefined> = {};
  for (const [outputKey, outputDefinition] of Object.entries(jobOutputDefinitions)) {
    const outputValue = outputDefinition.replace(/\$\{\{(.+?)\}\}/g, (_match, expression) => {
      return `${jsepEval(expression, interpolationContext) ?? ''}`;
    });

    jobOutputs[outputKey] = outputValue;
  }

  return jobOutputs;
}

/** This is what we'll use to generate an object representing a step. */
export function getStepOutputsAsObject(step: BuildStep): {
  outputs: Record<string, string | undefined>;
} {
  const outputs = Object.fromEntries(
    Object.entries(step.outputById).map(([id, output]) => [id, output.value ?? '']) ?? []
  );

  return { outputs };
}
