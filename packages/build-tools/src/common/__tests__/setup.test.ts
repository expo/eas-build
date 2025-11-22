import { randomUUID } from 'crypto';
import path from 'path';

import { vol } from 'memfs';
import fs from 'fs-extra';
import {
  Platform,
  BuildMode,
  BuildTrigger,
  Workflow,
  ArchiveSourceType,
  BuildJob,
} from '@expo/eas-build-job';

import { BuildContext } from '../..';
import { prepareProjectAsync } from '../setup';
import { createMockLogger } from '../../__tests__/utils/logger';

jest.mock('../projectSources');

describe('setup', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should delete .expo directory if it exists', async () => {
    // Arrange
    const projectRoot = '/app';
    await vol.promises.mkdir(path.join(projectRoot, '.expo'), { recursive: true });
    await vol.promises.writeFile(path.join(projectRoot, '.expo', 'test.txt'), 'test');

    const ctx = new BuildContext(
      {
        triggeredBy: BuildTrigger.EAS_CLI,
        type: Workflow.MANAGED,
        mode: BuildMode.BUILD,
        initiatingUserId: randomUUID(),
        appId: randomUUID(),
        projectArchive: {
          type: ArchiveSourceType.PATH,
          path: projectRoot,
        },
        platform: Platform.IOS,
        secrets: {
          robotAccessToken: randomUUID(),
          environmentSecrets: [],
        },
      } as BuildJob,
      {
        env: {},
        workingdir: '/workingdir',
        logger: createMockLogger(),
        logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
        uploadArtifact: jest.fn(),
      }
    );
    jest.spyOn(ctx, 'getReactNativeProjectDirectory').mockReturnValue(projectRoot);

    // Act
    await prepareProjectAsync(ctx);

    // Assert
    expect(await fs.pathExists(path.join(projectRoot, '.expo'))).toBe(false);
  });

  it('should not fail if .expo directory does not exist', async () => {
    const projectRoot = '/app';

    const ctx = new BuildContext(
      {
        triggeredBy: BuildTrigger.EAS_CLI,
        type: Workflow.MANAGED,
        mode: BuildMode.BUILD,
        initiatingUserId: randomUUID(),
        appId: randomUUID(),
        projectArchive: {
          type: ArchiveSourceType.PATH,
          path: projectRoot,
        },
        platform: Platform.IOS,
        secrets: {
          robotAccessToken: randomUUID(),
          environmentSecrets: [],
        },
      } as BuildJob,
      {
        env: {},
        workingdir: '/workingdir',
        logger: createMockLogger(),
        logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
        uploadArtifact: jest.fn(),
      }
    );
    jest.spyOn(ctx, 'getReactNativeProjectDirectory').mockReturnValue(projectRoot);

    await prepareProjectAsync(ctx);

    expect(await fs.pathExists(path.join(projectRoot, '.expo'))).toBe(false);
  });
});
