import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import fetch, { Response } from 'node-fetch';
import { bunyan } from '@expo/logger';

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
      BuildStepInput.createProvider({
        id: 'slack_hook_url',
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        required: false,
      }),
    ],
    fn: async (stepCtx, { inputs, env }) => {
      const { logger } = stepCtx;
      const slackMessage = inputs.message.value as string;
      const slackHookUrl = (inputs.slack_hook_url.value as string) ?? env.SLACK_HOOK_URL;
      if (!slackHookUrl) {
        logger.warn(
          'Slack webhook URL not provided - provide input "slack_hook_url" or set "SLACK_HOOK_URL" secret'
        );
        throw new Error(
          'Sending Slack message failed - provide input "slack_hook_url" or set "SLACK_HOOK_URL" secret'
        );
      }
      await sendSlackMessageAsync({ logger, slackHookUrl, slackMessage });
    },
  });
}

async function sendSlackMessageAsync({
  logger,
  slackHookUrl,
  slackMessage,
}: {
  logger: bunyan;
  slackHookUrl: string;
  slackMessage: string;
}): Promise<void> {
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
