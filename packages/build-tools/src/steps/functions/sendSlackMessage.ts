import {
  BuildFunction,
  BuildStepContext,
  BuildStepInput,
  BuildStepInputValueTypeName,
} from '@expo/steps';
import { BuildStepInputById } from '@expo/steps/dist_esm/BuildStepInput';

export function createSendSlackMessageFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'send_slack_message',
    name: 'Send Slack message',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'slack_hook_url',
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        required: true,
      }),
      BuildStepInput.createProvider({
        id: 'message',
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        required: true,
      }),
    ],
    fn: async (stepCtx, { inputs }) => {
      await sendSlackMessageAsync(stepCtx, inputs);
    },
  });
}

export async function sendSlackMessageAsync(
  stepCtx: BuildStepContext,
  inputs: BuildStepInputById
): Promise<void> {
  const { logger } = stepCtx;
  const slackHookUrl = inputs.slack_hook_url.value as string;
  const slackMessage = inputs.message.value as string;
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
