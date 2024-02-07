import {
  BuildFunction,
  BuildStepContext,
  BuildStepEnv,
  BuildStepInput,
  BuildStepInputValueTypeName,
} from '@expo/steps';
import { BuildStepInputById } from '@expo/steps/dist_esm/BuildStepInput';
import fetch, { Response } from 'node-fetch';

export function createSendSlackMessageFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'send_slack_message',
    name: 'Send Slack message',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'message',
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        required: true,
      }),
    ],
    fn: async (stepCtx, { inputs, env }) => {
      await sendSlackMessageAsync(stepCtx, { inputs, env });
    },
  });
}

export async function sendSlackMessageAsync(
  stepCtx: BuildStepContext,
  { inputs, env }: { inputs: BuildStepInputById; env: BuildStepEnv }
): Promise<void> {
  const { logger } = stepCtx;
  const slackHookUrl = env.SLACK_HOOK_URL;
  const slackMessage = inputs.message.value as string;
  if (!slackHookUrl) {
    logger.warn(`"SLACK_HOOK_URL" secret not set`);
    throw new Error(`Sending Slack message failed - set "SLACK_HOOK_URL" secret`);
  }
  logger.info('Sending Slack message');

  const body = { text: slackMessage };
  let fetchResult: Response;
  try {
    fetchResult = await fetch(slackHookUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.warn(`Sending Slack message to webhook url "${slackHookUrl}" failed`);
    logger.debug(error);
    throw new Error(`Sending Slack message to webhook url "${slackHookUrl}" failed`);
  }
  if (!fetchResult.ok) {
    logger.warn(
      `Sending Slack message to webhook url "${slackHookUrl}" failed with status ${fetchResult.status}`
    );
    logger.debug(`${fetchResult.status} - ${fetchResult.statusText}`);
    throw new Error(
      `Sending Slack message to webhook url "${slackHookUrl}" failed with status ${fetchResult.status}`
    );
  }
  logger.info('Slack message sent successfully');
}
