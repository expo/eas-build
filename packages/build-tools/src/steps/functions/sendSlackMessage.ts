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
    ],
    fn: async (stepCtx, { inputs, env }) => {
      const { logger } = stepCtx;
      const slackHookUrl = env.SLACK_HOOK_URL;
      const slackMessage = inputs.message.value as string;
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
  slackHookUrl: string | undefined;
  slackMessage: string;
}): Promise<void> {
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
