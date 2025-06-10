import { randomBytes, randomUUID } from 'crypto';

import {
  ArchiveSourceType,
  BuildMode,
  BuildTrigger,
  Job,
  Platform,
  Workflow,
} from '@expo/eas-build-job';
import fetch, { Response } from 'node-fetch';
import { vol } from 'memfs';

import { BuildContext } from '../../context';
import { createMockLogger } from '../../__tests__/utils/logger';
import { prepareProjectSourcesAsync } from '../projectSources';
import { shallowCloneRepositoryAsync } from '../git';

jest.mock('@expo/turtle-spawn');
jest.mock('node-fetch');
jest.mock('../git');

describe('projectSources', () => {
  it('should use the refreshed repository URL', async () => {
    const robotAccessToken = randomUUID();
    const buildId = randomUUID();
    await vol.promises.mkdir('/workingdir/environment-secrets/', { recursive: true });

    const ctx = new BuildContext(
      {
        triggeredBy: BuildTrigger.GIT_BASED_INTEGRATION,
        type: Workflow.MANAGED,
        mode: BuildMode.BUILD,
        initiatingUserId: randomUUID(),
        appId: randomUUID(),
        projectArchive: {
          type: ArchiveSourceType.GIT,
          repositoryUrl: 'https://x-access-token:1234567890@github.com/expo/eas-build.git',
          gitRef: 'refs/heads/main',
          gitCommitHash: randomBytes(20).toString('hex'),
        },
        platform: Platform.IOS,
        secrets: {
          robotAccessToken,
          environmentSecrets: [],
        },
      } as Job,
      {
        env: {
          __API_SERVER_URL: 'https://api.expo.dev',
          EXPO_TOKEN: robotAccessToken,
          EAS_BUILD_ID: buildId,
        },
        workingdir: '/workingdir',
        logger: createMockLogger(),
        logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
        uploadArtifact: jest.fn(),
      }
    );
    const fetchMock = jest.mocked(fetch);
    fetchMock.mockImplementation(
      async () =>
        ({
          ok: true,
          json: async () => ({
            repositoryUrl: 'https://x-access-token:qwerty@github.com/expo/eas-build.git',
          }),
        }) as Response
    );

    await prepareProjectSourcesAsync(ctx);
    expect(shallowCloneRepositoryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        archiveSource: {
          ...ctx.job.projectArchive,
          repositoryUrl: 'https://x-access-token:qwerty@github.com/expo/eas-build.git',
        },
      })
    );
  });

  it('should fallback to the original repository URL if the refresh fails', async () => {
    const robotAccessToken = randomUUID();
    const buildId = randomUUID();
    await vol.promises.mkdir('/workingdir/environment-secrets/', { recursive: true });

    const ctx = new BuildContext(
      {
        triggeredBy: BuildTrigger.GIT_BASED_INTEGRATION,
        type: Workflow.MANAGED,
        mode: BuildMode.BUILD,
        initiatingUserId: randomUUID(),
        appId: randomUUID(),
        projectArchive: {
          type: ArchiveSourceType.GIT,
          repositoryUrl: 'https://x-access-token:1234567890@github.com/expo/eas-build.git',
          gitRef: 'refs/heads/main',
          gitCommitHash: randomBytes(20).toString('hex'),
        },
        platform: Platform.IOS,
        secrets: {
          robotAccessToken,
          environmentSecrets: [],
        },
      } as Job,
      {
        env: {
          __API_SERVER_URL: 'https://api.expo.dev',
          EXPO_TOKEN: robotAccessToken,
          EAS_BUILD_ID: buildId,
        },
        workingdir: '/workingdir',
        logger: createMockLogger(),
        logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
        uploadArtifact: jest.fn(),
      }
    );
    const fetchMock = jest.mocked(fetch);
    fetchMock.mockImplementation(
      async () =>
        ({
          ok: false,
          text: async () => 'Failed to generate repository URL',
        }) as Response
    );

    await prepareProjectSourcesAsync(ctx);
    expect(shallowCloneRepositoryAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        archiveSource: {
          ...ctx.job.projectArchive,
          repositoryUrl: 'https://x-access-token:1234567890@github.com/expo/eas-build.git',
        },
      })
    );
    fetchMock.mockImplementation(
      async () =>
        ({
          ok: false,
          json: async () => ({
            // repositoryUrl is the right key
            repository_url: 'https://x-access-token:qwerty@github.com/expo/eas-build.git',
          }),
        }) as Response
    );

    await prepareProjectSourcesAsync(ctx);
    expect(shallowCloneRepositoryAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        archiveSource: {
          ...ctx.job.projectArchive,
          repositoryUrl: 'https://x-access-token:1234567890@github.com/expo/eas-build.git',
        },
      })
    );

    fetchMock.mockImplementation(
      async () =>
        ({
          ok: false,
          json: () => Promise.reject(new Error('Failed to generate repository URL')),
        }) as Response
    );

    await prepareProjectSourcesAsync(ctx);
    expect(shallowCloneRepositoryAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        archiveSource: {
          ...ctx.job.projectArchive,
          repositoryUrl: 'https://x-access-token:1234567890@github.com/expo/eas-build.git',
        },
      })
    );

    expect(shallowCloneRepositoryAsync).toHaveBeenCalledTimes(3);
  });

  it(`should fallback to the original repository URL if we're missing some config`, async () => {
    const robotAccessToken = randomUUID();
    await vol.promises.mkdir('/workingdir/environment-secrets/', { recursive: true });
    const logger = createMockLogger();

    const ctx = new BuildContext(
      {
        triggeredBy: BuildTrigger.GIT_BASED_INTEGRATION,
        type: Workflow.MANAGED,
        mode: BuildMode.BUILD,
        initiatingUserId: randomUUID(),
        appId: randomUUID(),
        projectArchive: {
          type: ArchiveSourceType.GIT,
          repositoryUrl: 'https://x-access-token:1234567890@github.com/expo/eas-build.git',
          gitRef: 'refs/heads/main',
          gitCommitHash: randomBytes(20).toString('hex'),
        },
        platform: Platform.IOS,
        secrets: {
          robotAccessToken,
          environmentSecrets: [],
        },
      } as Job,
      {
        env: {
          __API_SERVER_URL: 'https://api.expo.dev',
          EXPO_TOKEN: robotAccessToken,
          // EAS_BUILD_ID: buildId,
        },
        workingdir: '/workingdir',
        logger,
        logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
        uploadArtifact: jest.fn(),
      }
    );

    await prepareProjectSourcesAsync(ctx);

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to refresh repository URL, using the one from the job',
      expect.any(Error)
    );
  });
});
