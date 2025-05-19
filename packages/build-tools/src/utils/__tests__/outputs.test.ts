import { randomBytes, randomUUID } from 'crypto';

import { JobInterpolationContext } from '@expo/eas-build-job';
import {
  BuildRuntimePlatform,
  BuildStep,
  BuildStepGlobalContext,
  BuildStepOutput,
} from '@expo/steps';
import { createLogger } from '@expo/logger';
import fetch, { Response } from 'node-fetch';

import { collectJobOutputs, uploadJobOutputsToWwwAsync } from '../outputs';
import { TurtleFetchError } from '../turtleFetch';

jest.mock('node-fetch');

const workflowJobId = randomUUID();
const robotAccessToken = randomBytes(32).toString('hex');

const env = {
  __WORKFLOW_JOB_ID: workflowJobId,
};

const context = new BuildStepGlobalContext(
  {
    buildLogsDirectory: 'test',
    projectSourceDirectory: 'test',
    projectTargetDirectory: 'test',
    defaultWorkingDirectory: 'test',
    runtimePlatform: BuildRuntimePlatform.DARWIN,
    staticContext: () => ({
      job: {
        outputs: {
          fingerprintHash: '${{ steps.setup.outputs.fingerprint_hash }}',
          nodeVersion: '${{ steps.node_setup.outputs.node_version }}',
        },
        secrets: {
          robotAccessToken,
        },
      } as any,
      metadata: {} as any,
      env,
      expoApiServerURL: 'https://api.expo.test',
    }),
    env,
    logger: createLogger({ name: 'test' }),
    updateEnv: () => {},
  },
  false
);

const fingerprintHashStepOutput = new BuildStepOutput(context, {
  id: 'fingerprint_hash',
  stepDisplayName: 'test',
  required: true,
});
fingerprintHashStepOutput.set('mock-fingerprint-hash');

const unusedStepOutput = new BuildStepOutput(context, {
  id: 'test3',
  stepDisplayName: 'test',
  required: false,
});

context.registerStep(
  new BuildStep(context, {
    id: 'setup',
    displayName: 'test',
    command: 'test',
    outputs: [fingerprintHashStepOutput, unusedStepOutput],
  })
);

const nodeVersionStepOutput = new BuildStepOutput(context, {
  id: 'node_version',
  stepDisplayName: 'test2',
  required: false,
});

context.registerStep(
  new BuildStep(context, {
    id: 'node_setup',
    displayName: 'test2',
    command: 'test2',
    outputs: [nodeVersionStepOutput],
  })
);

const interpolationContext: JobInterpolationContext = {
  ...context.staticContext,
  always: () => true,
  never: () => false,
  success: () => !context.hasAnyPreviousStepFailed,
  failure: () => context.hasAnyPreviousStepFailed,
  fromJSON: (json: string) => JSON.parse(json),
  toJSON: (value: unknown) => JSON.stringify(value),
  contains: (value: string, substring: string) => value.includes(substring),
  startsWith: (value: string, prefix: string) => value.startsWith(prefix),
  endsWith: (value: string, suffix: string) => value.endsWith(suffix),
};

describe(collectJobOutputs, () => {
  it('returns empty object for outputs of a step with no outputs', () => {
    expect(
      collectJobOutputs({
        jobOutputDefinitions: {},
        interpolationContext,
      })
    ).toEqual({});
  });

  it('interpolates outputs', () => {
    expect(
      collectJobOutputs({
        jobOutputDefinitions: {
          test: '${{ 1 + 1 }}',
        },
        interpolationContext,
      })
    ).toEqual({ test: '2' });

    expect(
      collectJobOutputs({
        jobOutputDefinitions: {
          fingerprint_hash: '${{ steps.setup.outputs.fingerprint_hash }}',
        },
        interpolationContext,
      })
    ).toEqual({ fingerprint_hash: 'mock-fingerprint-hash' });
  });

  it('defaults missing values to empty string', () => {
    expect(
      collectJobOutputs({
        jobOutputDefinitions: {
          missing_output: '${{ steps.setup.outputs.missing_output }}',
          not_set_output: '${{ steps.setup.outputs.test_3 }}',
        },
        interpolationContext,
      })
    ).toEqual({ missing_output: '', not_set_output: '' });
  });
});

describe(uploadJobOutputsToWwwAsync, () => {
  it('uploads outputs', async () => {
    const logger = createLogger({ name: 'test' }).child('test');

    const fetchMock = jest.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as unknown as Response);
    await uploadJobOutputsToWwwAsync(context, {
      logger,
      expoApiV2BaseUrl: 'http://exp.test/--/api/v2/',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `http://exp.test/--/api/v2/workflows/${workflowJobId}`, // URL
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${robotAccessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
        body: JSON.stringify({
          outputs: { fingerprintHash: 'mock-fingerprint-hash', nodeVersion: '' },
        }),
      })
    );
  });

  it('outputs upload fails, succeeds on retry', async () => {
    const logger = createLogger({ name: 'test' }).child('test');

    const fetchMock = jest.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Request failed',
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as unknown as Response);
    await uploadJobOutputsToWwwAsync(context, {
      logger,
      expoApiV2BaseUrl: 'http://exp.test/--/api/v2/',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `http://exp.test/--/api/v2/workflows/${workflowJobId}`, // URL
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${robotAccessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
        body: JSON.stringify({
          outputs: { fingerprintHash: 'mock-fingerprint-hash', nodeVersion: '' },
        }),
      })
    );
  });

  it('outputs upload fails', async () => {
    const logger = createLogger({ name: 'test' }).child('test');

    const loggerErrorSpy = jest.spyOn(logger, 'error');
    const fetchMock = jest.mocked(fetch);
    const expectedFetchResponse = {
      ok: false,
      status: 400,
      statusText: 'Request failed',
    } as unknown as Response;
    fetchMock.mockResolvedValue(expectedFetchResponse);
    const expectedThrownError = new TurtleFetchError(
      'Request failed with status 400',
      expectedFetchResponse
    );
    await expect(
      uploadJobOutputsToWwwAsync(context, {
        logger,
        expoApiV2BaseUrl: 'http://exp.test/--/api/v2/',
      })
    ).rejects.toThrow(expectedThrownError);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://exp.test/--/api/v2/workflows/${workflowJobId}`, // URL
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${robotAccessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
        body: JSON.stringify({
          outputs: { fingerprintHash: 'mock-fingerprint-hash', nodeVersion: '' },
        }),
      })
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      { err: expectedThrownError },
      'Failed to upload outputs'
    );
  });
});
