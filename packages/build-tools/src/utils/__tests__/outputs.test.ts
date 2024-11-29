import { randomUUID } from 'crypto';

import { Generic } from '@expo/eas-build-job';
import {
  BuildRuntimePlatform,
  BuildStep,
  BuildStepGlobalContext,
  BuildStepOutput,
} from '@expo/steps';
import { createLogger } from '@expo/logger';
import fetch, { Response } from 'node-fetch';

import {
  getStepOutputsAsObject,
  getJobOutputsFromSteps,
  uploadJobOutputsToWwwAsync,
} from '../outputs';
import { BuildContext } from '../../context';
import { TurtleFetchError } from '../turtleFetch';

jest.mock('node-fetch');

const context = new BuildStepGlobalContext(
  {
    buildLogsDirectory: 'test',
    projectSourceDirectory: 'test',
    projectTargetDirectory: 'test',
    defaultWorkingDirectory: 'test',
    runtimePlatform: BuildRuntimePlatform.DARWIN,
    staticContext: () => ({
      job: {} as any,
      metadata: {} as any,
      env: {} as any,
      expoApiServerURL: 'https://api.expo.test',
    }),
    env: {},
    logger: createLogger({ name: 'test' }),
    updateEnv: () => {},
  },
  false
);

describe(getStepOutputsAsObject, () => {
  it('returns empty object for outputs of a step with no outputs', () => {
    expect(
      getStepOutputsAsObject(
        new BuildStep(context, {
          id: 'test',
          displayName: 'test',
          command: 'test',
        })
      )
    ).toEqual({ outputs: {} });
  });

  it(`returns outputs from a step when they're defined`, () => {
    expect(
      getStepOutputsAsObject(
        new BuildStep(context, {
          id: 'test',
          displayName: 'test',
          command: 'test',
          outputs: [
            new BuildStepOutput(context, {
              id: 'test',
              stepDisplayName: 'test',
              required: false,
            }),
          ],
        })
      )
    ).toEqual({ outputs: { test: '' } });

    const output1 = new BuildStepOutput(context, {
      id: 'test',
      stepDisplayName: 'test',
      required: false,
    });
    const output2 = new BuildStepOutput(context, {
      id: 'test2',
      stepDisplayName: 'test2',
      required: true,
    });
    const output3 = new BuildStepOutput(context, {
      id: 'test3',
      stepDisplayName: 'test3',
      required: false,
    });
    output1.set('abc');
    output2.set('true');
    expect(
      getStepOutputsAsObject(
        new BuildStep(context, {
          id: 'test',
          displayName: 'test',
          command: 'test',
          outputs: [output1, output2, output3],
        })
      )
    ).toEqual({ outputs: { test: 'abc', test2: 'true', test3: '' } });
  });
});

describe(getJobOutputsFromSteps, () => {
  it('returns empty object for outputs of a step with no outputs', () => {
    expect(
      getJobOutputsFromSteps({
        jobOutputDefinitions: {},
        interpolationContext: { steps: {} },
      })
    ).toEqual({});
  });

  it('interpolates outputs', () => {
    expect(
      getJobOutputsFromSteps({
        jobOutputDefinitions: {
          test: '${{ 1 + 1 }}',
        },
        interpolationContext: { steps: {} },
      })
    ).toEqual({ test: '2' });

    expect(
      getJobOutputsFromSteps({
        jobOutputDefinitions: {
          fingerprint_hash: '${{ steps.setup.outputs.fingerprint_hash }}',
        },
        interpolationContext: {
          steps: { setup: { outputs: { fingerprint_hash: 'abc' } } },
        },
      })
    ).toEqual({ fingerprint_hash: 'abc' });
  });
});

describe(uploadJobOutputsToWwwAsync, () => {
  it('uploads outputs', async () => {
    const workflowJobId = randomUUID();
    const robotAccessToken = randomUUID();

    const logger = createLogger({ name: 'test' }).child('test');
    const buildContext = {
      job: {
        outputs: {
          fingerprintHash: '${{ steps.setup.outputs.fingerprint_hash }}',
          nodeVersion: '${{ steps.node_setup.outputs.node_version }}',
        },
        builderEnvironment: {
          env: {
            __WORKFLOW_JOB_ID: workflowJobId,
          },
        },
        secrets: {
          robotAccessToken,
        },
      } as unknown as Generic.Job,
      logBuffer: {
        getLogs: () => [],
        getPhaseLogs: () => [],
      },
      _metadata: {} as any,
      logger,
      reportBuildPhaseStats: () => {},
    } as unknown as BuildContext<Generic.Job>;

    const fingerprintHashStepOutput = new BuildStepOutput(context, {
      id: 'fingerprint_hash',
      stepDisplayName: 'test',
      required: true,
    });
    const nodeVersionStepOutput = new BuildStepOutput(context, {
      id: 'node_version',
      stepDisplayName: 'test2',
      required: false,
    });
    const unusedStepOutput = new BuildStepOutput(context, {
      id: 'test3',
      stepDisplayName: 'test3',
      required: false,
    });
    fingerprintHashStepOutput.set('mock-fingerprint-hash');
    unusedStepOutput.set('true');

    const fetchMock = jest.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as unknown as Response);
    await uploadJobOutputsToWwwAsync(buildContext, {
      steps: [
        new BuildStep(context, {
          id: 'setup',
          displayName: 'test',
          command: 'test',
          outputs: [fingerprintHashStepOutput, unusedStepOutput],
        }),
        new BuildStep(context, {
          id: 'node_setup',
          displayName: 'test2',
          command: 'test2',
          outputs: [nodeVersionStepOutput],
        }),
      ],
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
    const workflowJobId = randomUUID();
    const robotAccessToken = randomUUID();

    const logger = createLogger({ name: 'test' }).child('test');
    const buildContext = {
      job: {
        outputs: {
          fingerprintHash: '${{ steps.setup.outputs.fingerprint_hash }}',
          nodeVersion: '${{ steps.node_setup.outputs.node_version }}',
        },
        builderEnvironment: {
          env: {
            __WORKFLOW_JOB_ID: workflowJobId,
          },
        },
        secrets: {
          robotAccessToken,
        },
      } as unknown as Generic.Job,
      logBuffer: {
        getLogs: () => [],
        getPhaseLogs: () => [],
      },
      _metadata: {} as any,
      logger,
      reportBuildPhaseStats: () => {},
    } as unknown as BuildContext<Generic.Job>;

    const fingerprintHashStepOutput = new BuildStepOutput(context, {
      id: 'fingerprint_hash',
      stepDisplayName: 'test',
      required: true,
    });
    const nodeVersionStepOutput = new BuildStepOutput(context, {
      id: 'node_version',
      stepDisplayName: 'test2',
      required: false,
    });
    const unusedStepOutput = new BuildStepOutput(context, {
      id: 'test3',
      stepDisplayName: 'test3',
      required: false,
    });
    fingerprintHashStepOutput.set('mock-fingerprint-hash');
    unusedStepOutput.set('true');

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
    await uploadJobOutputsToWwwAsync(buildContext, {
      steps: [
        new BuildStep(context, {
          id: 'setup',
          displayName: 'test',
          command: 'test',
          outputs: [fingerprintHashStepOutput, unusedStepOutput],
        }),
        new BuildStep(context, {
          id: 'node_setup',
          displayName: 'test2',
          command: 'test2',
          outputs: [nodeVersionStepOutput],
        }),
      ],
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
    const workflowJobId = randomUUID();
    const robotAccessToken = randomUUID();

    const logger = createLogger({ name: 'test' }).child('test');
    const buildContext = {
      job: {
        outputs: {
          fingerprintHash: '${{ steps.setup.outputs.fingerprint_hash }}',
          nodeVersion: '${{ steps.node_setup.outputs.node_version }}',
        },
        builderEnvironment: {
          env: {
            __WORKFLOW_JOB_ID: workflowJobId,
          },
        },
        secrets: {
          robotAccessToken,
        },
      } as unknown as Generic.Job,
      logBuffer: {
        getLogs: () => [],
        getPhaseLogs: () => [],
      },
      _metadata: {} as any,
      logger,
      reportBuildPhaseStats: () => {},
    } as unknown as BuildContext<Generic.Job>;

    const fingerprintHashStepOutput = new BuildStepOutput(context, {
      id: 'fingerprint_hash',
      stepDisplayName: 'test',
      required: true,
    });
    const nodeVersionStepOutput = new BuildStepOutput(context, {
      id: 'node_version',
      stepDisplayName: 'test2',
      required: false,
    });
    const unusedStepOutput = new BuildStepOutput(context, {
      id: 'test3',
      stepDisplayName: 'test3',
      required: false,
    });
    fingerprintHashStepOutput.set('mock-fingerprint-hash');
    unusedStepOutput.set('true');

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
      uploadJobOutputsToWwwAsync(buildContext, {
        steps: [
          new BuildStep(context, {
            id: 'setup',
            displayName: 'test',
            command: 'test',
            outputs: [fingerprintHashStepOutput, unusedStepOutput],
          }),
          new BuildStep(context, {
            id: 'node_setup',
            displayName: 'test2',
            command: 'test2',
            outputs: [nodeVersionStepOutput],
          }),
        ],
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
