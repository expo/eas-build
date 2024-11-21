import { Generic } from '@expo/eas-build-job';
import { BuildStep, jsepEval } from '@expo/steps';
import { bunyan } from '@expo/logger';
import nullthrows from 'nullthrows';
import fetch from 'node-fetch';

import { BuildContext } from '../context';

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
      steps: Object.fromEntries(steps.map((step) => [step.id, getDynamicValuesFromStep(step)])),
    };
    logger.info({ dynamicValues: interpolationContext }, 'Using dynamic values');

    const outputs = getJobOutputsFromSteps({
      jobOutputDefinitions: ctx.job.outputs,
      interpolationContext,
    });
    logger.info('Uploading outputs');

    await fetch(new URL(`workflows/${workflowJobId}`, expoApiV2BaseUrl).toString(), {
      method: 'PATCH',
      body: JSON.stringify({ outputs }),
      headers: {
        Authorization: `Bearer ${robotAccessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to upload outputs');
  }
}

/** Function we use to get outputs of the whole job from steps. */
export function getJobOutputsFromSteps({
  jobOutputDefinitions,
  interpolationContext,
}: {
  jobOutputDefinitions: Record<string, string>;
  interpolationContext: Record<string, any>;
}): Record<string, string | undefined> {
  const jobOutputs: Record<string, string | undefined> = {};
  for (const [outputKey, outputDefinition] of Object.entries(jobOutputDefinitions)) {
    const outputValue = outputDefinition.replace(/\$\{\{(.+?)\}\}/g, (_match, expression) => {
      return `${jsepEval(expression, interpolationContext)}`;
    });

    jobOutputs[outputKey] = outputValue;
  }

  return jobOutputs;
}

/** This is what we'll use to generate an object representing a step. */
export function getDynamicValuesFromStep(step: BuildStep): {
  outputs: Record<string, string | undefined>;
} {
  const outputs = Object.fromEntries(
    Object.entries(step.outputById).map(([id, output]) => [id, output.value ?? '']) ?? []
  );

  return { outputs };
}
