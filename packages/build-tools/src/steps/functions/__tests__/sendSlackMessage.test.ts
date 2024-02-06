import { errors } from '@expo/steps';

import { createSendSlackMessageFunction } from '../sendSlackMessage';
import { createGlobalContextMock } from '../../../__tests__/utils/context';

jest.mock('@expo/logger');

describe(createSendSlackMessageFunction, () => {
  let fetchMock: jest.SpyInstance;
  let loggerInfoMock: jest.SpyInstance;
  let loggerWarnMock: jest.SpyInstance;
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  const sendSlackMessage = createSendSlackMessageFunction();
  it('calls the webhook and logs the info messages when successful', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ status: 200, ok: true, body: 'ok' }));
    const buildStep = sendSlackMessage.createBuildStepFromFunctionCall(
      createGlobalContextMock({}),
      {
        callInputs: {
          slack_hook_url: 'https://slack.hook.url',
          message: 'Test message',
        },
      }
    );
    loggerInfoMock = jest.spyOn(buildStep.ctx.logger, 'info');
    loggerWarnMock = jest.spyOn(buildStep.ctx.logger, 'warn');
    await buildStep.executeAsync();
    expect(fetchMock).toHaveBeenCalledWith('https://slack.hook.url', {
      method: 'POST',
      body: JSON.stringify({ text: 'Test message' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loggerInfoMock).toHaveBeenCalledTimes(4);
    expect(loggerInfoMock.mock.calls[0]).toEqual([
      { marker: 'start-step' },
      'Executing build step "Send Slack message"',
    ]);
    expect(loggerInfoMock.mock.calls[1]).toEqual(['Sending Slack message']);
    expect(loggerInfoMock.mock.calls[2]).toEqual(['Slack message sent successfully']);
    expect(loggerInfoMock.mock.calls[3]).toEqual([
      { marker: 'end-step', result: 'success' },
      'Finished build step "Send Slack message" successfully',
    ]);
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });
  it('does not call the webhook when no url specified', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ status: 200, ok: true, body: 'ok' }));
    const buildStep = sendSlackMessage.createBuildStepFromFunctionCall(
      createGlobalContextMock({}),
      {
        callInputs: {
          message: 'Test message',
        },
        id: sendSlackMessage.id,
      }
    );
    loggerInfoMock = jest.spyOn(buildStep.ctx.logger, 'info');
    loggerWarnMock = jest.spyOn(buildStep.ctx.logger, 'warn');
    const expectedError = new errors.BuildStepRuntimeError(
      `Input parameter "slack_hook_url" for step "send_slack_message" is required but it was not set.`
    );
    await expect(buildStep.executeAsync()).rejects.toThrow(expectedError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loggerInfoMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoMock.mock.calls[0]).toEqual([
      { marker: 'start-step' },
      'Executing build step "Send Slack message"',
    ]);
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });
});
