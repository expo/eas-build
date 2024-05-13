import { BuildJob } from '@expo/eas-build-job';
import { spawnAsync } from '@expo/steps';
import { vol } from 'memfs';

import { BuildContext } from '../../context';
import { Hook, runHookIfPresent } from '../hooks';
import { PackageManager } from '../packageManager';

jest.mock('fs');
jest.mock('@expo/steps', () => {
  const spawnAsync = jest.fn();
  return {
    ...jest.requireActual('@expo/steps'),
    spawnAsync,
    __esModule: true,
  };
});

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  child: () => loggerMock,
};

let ctx: BuildContext<BuildJob>;

describe(runHookIfPresent, () => {
  beforeEach(() => {
    vol.reset();
    (spawnAsync as jest.Mock).mockReset();

    ctx = new BuildContext({ projectRootDirectory: '.' } as BuildJob, {
      workingdir: '/workingdir',
      logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
      logger: loggerMock as any,
      env: {},
      uploadArtifact: jest.fn(),
    });
  });

  it('runs the hook if present in package.json', async () => {
    vol.fromJSON(
      {
        './package.json': JSON.stringify({
          scripts: {
            [Hook.PRE_INSTALL]: 'echo pre_install',
            [Hook.POST_INSTALL]: 'echo post_install',
            [Hook.PRE_UPLOAD_ARTIFACTS]: 'echo pre_upload_artifacts',
          },
        }),
      },
      '/workingdir/build'
    );

    await runHookIfPresent(ctx, Hook.PRE_INSTALL);

    expect(spawnAsync).toBeCalledWith(
      PackageManager.YARN,
      ['run', Hook.PRE_INSTALL],
      expect.anything()
    );
  });

  it('runs the hook with yarn if yarn.lock exists', async () => {
    vol.fromJSON(
      {
        './package.json': JSON.stringify({
          scripts: {
            [Hook.PRE_INSTALL]: 'echo pre_install',
            [Hook.POST_INSTALL]: 'echo post_install',
            [Hook.PRE_UPLOAD_ARTIFACTS]: 'echo pre_upload_artifacts',
          },
        }),
        './yarn.lock': 'fakelockfile',
      },
      '/workingdir/build'
    );

    await runHookIfPresent(ctx, Hook.PRE_INSTALL);

    expect(spawnAsync).toBeCalledWith(
      PackageManager.YARN,
      ['run', Hook.PRE_INSTALL],
      expect.anything()
    );
  });

  it('runs the PRE_INSTALL hook using npm when the project uses yarn 2', async () => {
    vol.fromJSON(
      {
        './package.json': JSON.stringify({
          scripts: {
            [Hook.PRE_INSTALL]: 'echo pre_install',
            [Hook.POST_INSTALL]: 'echo post_install',
            [Hook.PRE_UPLOAD_ARTIFACTS]: 'echo pre_upload_artifacts',
          },
        }),
        './yarn.lock': 'fakelockfile',
        './.yarnrc.yml': 'fakeyarn2config',
      },
      '/workingdir/build'
    );

    await runHookIfPresent(ctx, Hook.PRE_INSTALL);

    expect(spawnAsync).toBeCalledWith(
      PackageManager.NPM,
      ['run', Hook.PRE_INSTALL],
      expect.anything()
    );
    expect(true).toBe(true);
  });

  it('does not run the hook if not present in package.json', async () => {
    vol.fromJSON(
      {
        './package.json': JSON.stringify({
          scripts: {
            [Hook.POST_INSTALL]: 'echo post_install',
            [Hook.PRE_UPLOAD_ARTIFACTS]: 'echo pre_upload_artifacts',
          },
        }),
      },
      '/workingdir/build'
    );

    await runHookIfPresent(ctx, Hook.PRE_INSTALL);

    expect(spawnAsync).not.toBeCalled();
  });

  it('runs ON_BUILD_CANCEL hook if present', async () => {
    vol.fromJSON(
      {
        './package.json': JSON.stringify({
          scripts: {
            [Hook.ON_BUILD_CANCEL]: 'echo build_cancel',
          },
        }),
      },
      '/workingdir/build'
    );

    await runHookIfPresent(ctx, Hook.ON_BUILD_CANCEL);

    expect(spawnAsync).toBeCalledWith(
      ctx.packageManager,
      ['run', 'eas-build-on-cancel'],
      expect.anything()
    );
  });

  it('does not run ON_BUILD_CANCEL hook if not present', async () => {
    vol.fromJSON(
      {
        './package.json': JSON.stringify({
          scripts: {},
        }),
      },
      '/workingdir/build'
    );

    await runHookIfPresent(ctx, Hook.ON_BUILD_CANCEL);

    expect(spawnAsync).not.toHaveBeenCalled();
  });
});
