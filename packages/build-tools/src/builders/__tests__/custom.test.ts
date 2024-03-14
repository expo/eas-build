import { Job } from '@expo/eas-build-job';
import { vol } from 'memfs';

import { runCustomBuildAsync } from '../custom';
import { BuildContext } from '../../context';
import { createMockLogger } from '../../__tests__/utils/logger';
import { createTestIosJob } from '../../__tests__/utils/job';
import { findAndUploadXcodeBuildLogsAsync } from '../../ios/xcodeBuildLogs';

jest.mock('fs');
jest.mock('fs/promises');
jest.mock('../../common/projectSources');
jest.mock('../../ios/xcodeBuildLogs');

const findAndUploadXcodeBuildLogsAsyncMock = jest.mocked(findAndUploadXcodeBuildLogsAsync);

afterEach(() => {
  vol.reset();
});

describe(runCustomBuildAsync, () => {
  let ctx: BuildContext<Job>;

  beforeEach(() => {
    const job = createTestIosJob();
    vol.mkdirSync('/workingdir/env', { recursive: true });
    vol.mkdirSync('/workingdir/temporary-custom-build', { recursive: true });
    vol.fromJSON(
      {
        'test.yaml': `
          build:
            steps:
              - eas/checkout
          `,
      },
      '/workingdir/temporary-custom-build'
    );

    ctx = new BuildContext(
      {
        ...job,
        customBuildConfig: {
          path: 'test.yaml',
        },
      },
      {
        workingdir: '/workingdir',
        logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
        logger: createMockLogger(),
        env: {},
        runGlobalExpoCliCommand: jest.fn(),
        uploadArtifact: jest.fn(),
      }
    );
  });

  it('calls findAndUploadXcodeBuildLogsAsync in an iOS job if its artifacts is empty', async () => {
    await runCustomBuildAsync(ctx);
    expect(findAndUploadXcodeBuildLogsAsyncMock).toHaveBeenCalled();
  });

  it('does not call findAndUploadXcodeBuildLogsAsync in an iOS job if artifacts is already present', async () => {
    ctx.artifacts.XCODE_BUILD_LOGS = 'uploaded';
    await runCustomBuildAsync(ctx);
    expect(findAndUploadXcodeBuildLogsAsyncMock).not.toHaveBeenCalled();
  });
});
