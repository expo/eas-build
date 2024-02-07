import { errors } from '@expo/steps';
import fetch, { Response } from 'node-fetch';

import { createSendSlackMessageFunction } from '../sendSlackMessage';
import { createGlobalContextMock } from '../../../__tests__/utils/context';

jest.mock('@expo/logger');
jest.mock('node-fetch');

describe(createSendSlackMessageFunction, () => {
  const fetchMock = jest.mocked(fetch);
  const sendSlackMessage = createSendSlackMessageFunction();
  let loggerInfoMock: jest.SpyInstance;
  let loggerWarnMock: jest.SpyInstance;
  let loggerDebugMock: jest.SpyInstance;
  let loggerErrorMock: jest.SpyInstance;

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('calls the webhook and logs the info messages when successful', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ status: 200, ok: true } as Response));
    const buildStep = sendSlackMessage.createBuildStepFromFunctionCall(
      createGlobalContextMock({}),
      {
        callInputs: {
          message: 'Test message',
        },
        env: {
          SLACK_HOOK_URL: 'https://slack.hook.url',
        },
        id: sendSlackMessage.id,
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
    fetchMock.mockImplementation(() => Promise.resolve({ status: 200, ok: true } as Response));
    const buildStep = sendSlackMessage.createBuildStepFromFunctionCall(
      createGlobalContextMock({}),
      {
        callInputs: {
          message: 'Test message',
        },
        env: {},
        id: sendSlackMessage.id,
      }
    );
    loggerInfoMock = jest.spyOn(buildStep.ctx.logger, 'info');
    loggerWarnMock = jest.spyOn(buildStep.ctx.logger, 'warn');
    const expectedError = new errors.BuildStepRuntimeError(
      `Sending Slack message failed - set "SLACK_HOOK_URL" secret`
    );
    await expect(buildStep.executeAsync()).rejects.toThrow(expectedError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loggerInfoMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoMock.mock.calls[0]).toEqual([
      { marker: 'start-step' },
      'Executing build step "Send Slack message"',
    ]);
    expect(loggerWarnMock).toHaveBeenCalledWith('"SLACK_HOOK_URL" secret not set');
  });

  it('does not call the webhook when no message specified', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ status: 200, ok: true } as Response));
    const buildStep = sendSlackMessage.createBuildStepFromFunctionCall(
      createGlobalContextMock({}),
      {
        callInputs: {},
        env: {
          SLACK_HOOK_URL: 'https://slack.hook.url',
        },
        id: sendSlackMessage.id,
      }
    );
    loggerInfoMock = jest.spyOn(buildStep.ctx.logger, 'info');
    loggerWarnMock = jest.spyOn(buildStep.ctx.logger, 'warn');
    const expectedError = new errors.BuildStepRuntimeError(
      `Input parameter "message" for step "send_slack_message" is required but it was not set.`
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

  it('catches error if thrown, logs warning and details in debug, throws new error', async () => {
    const thrownError = new Error('Request failed');
    fetchMock.mockImplementation(() => {
      throw thrownError;
    });
    const buildStep = sendSlackMessage.createBuildStepFromFunctionCall(
      createGlobalContextMock({}),
      {
        callInputs: {
          message: 'Test message',
        },
        env: {
          SLACK_HOOK_URL: 'https://slack.hook.url',
        },
        id: sendSlackMessage.id,
      }
    );
    loggerInfoMock = jest.spyOn(buildStep.ctx.logger, 'info');
    loggerWarnMock = jest.spyOn(buildStep.ctx.logger, 'warn');
    loggerDebugMock = jest.spyOn(buildStep.ctx.logger, 'debug');
    loggerErrorMock = jest.spyOn(buildStep.ctx.logger, 'error');
    const expectedError = new Error(
      'Sending Slack message to webhook url "https://slack.hook.url" failed'
    );
    await expect(buildStep.executeAsync()).rejects.toThrow(expectedError);
    expect(fetchMock).toHaveBeenCalledWith('https://slack.hook.url', {
      method: 'POST',
      body: JSON.stringify({ text: 'Test message' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loggerInfoMock).toHaveBeenCalledTimes(2);
    expect(loggerInfoMock.mock.calls[0]).toEqual([
      { marker: 'start-step' },
      'Executing build step "Send Slack message"',
    ]);
    expect(loggerInfoMock.mock.calls[1]).toEqual(['Sending Slack message']);
    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock.mock.calls[0]).toEqual([
      'Sending Slack message to webhook url "https://slack.hook.url" failed',
    ]);
    expect(loggerDebugMock).toHaveBeenCalledWith(thrownError);
    expect(loggerErrorMock).toHaveBeenCalledWith({
      err: expectedError,
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      {
        marker: 'end-step',
        result: 'fail',
      },
      'Build step "Send Slack message" failed'
    );
  });

  it.each([
    [400, 'Bad request'],
    [500, 'Internal server error'],
  ])(
    'handles %s error status code, logs warning and details in debug, throws new error',
    async (statusCode, statusText) => {
      fetchMock.mockImplementation(() =>
        Promise.resolve({ status: statusCode, ok: false, statusText } as Response)
      );
      const buildStep = sendSlackMessage.createBuildStepFromFunctionCall(
        createGlobalContextMock({}),
        {
          callInputs: {
            message: 'Test message',
          },
          env: {
            SLACK_HOOK_URL: 'https://slack.hook.url',
          },
          id: sendSlackMessage.id,
        }
      );
      loggerInfoMock = jest.spyOn(buildStep.ctx.logger, 'info');
      loggerWarnMock = jest.spyOn(buildStep.ctx.logger, 'warn');
      loggerDebugMock = jest.spyOn(buildStep.ctx.logger, 'debug');
      loggerErrorMock = jest.spyOn(buildStep.ctx.logger, 'error');
      const expectedError = new Error(
        `Sending Slack message to webhook url "https://slack.hook.url" failed with status ${statusCode}`
      );
      await expect(buildStep.executeAsync()).rejects.toThrow(expectedError);
      expect(fetchMock).toHaveBeenCalledWith('https://slack.hook.url', {
        method: 'POST',
        body: JSON.stringify({ text: 'Test message' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(loggerInfoMock).toHaveBeenCalledTimes(2);
      expect(loggerInfoMock.mock.calls[0]).toEqual([
        { marker: 'start-step' },
        'Executing build step "Send Slack message"',
      ]);
      expect(loggerInfoMock.mock.calls[1]).toEqual(['Sending Slack message']);
      expect(loggerWarnMock).toHaveBeenCalledTimes(1);
      expect(loggerWarnMock.mock.calls[0]).toEqual([
        `Sending Slack message to webhook url "https://slack.hook.url" failed with status ${statusCode}`,
      ]);
      expect(loggerDebugMock).toHaveBeenCalledWith(`${statusCode} - ${statusText}`);
      expect(loggerErrorMock).toHaveBeenCalledWith({
        err: expectedError,
      });
      expect(loggerErrorMock).toHaveBeenCalledWith(
        {
          marker: 'end-step',
          result: 'fail',
        },
        `Build step "Send Slack message" failed`
      );
    }
  );
});
