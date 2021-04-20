import { Job } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';
import { vol } from 'memfs';

import { BuildContext } from '../../context';
import { Hook, runHookIfPresent } from '../hooks';
import { PackageManager } from '../packageManager';

jest.mock('fs');
jest.mock('@expo/turtle-spawn', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  child: () => loggerMock,
};

let ctx: BuildContext<Job>;

describe(runHookIfPresent, () => {
  beforeEach(() => {
    vol.reset();
    (spawn as jest.Mock).mockReset();

    ctx = new BuildContext({ projectRootDirectory: '.' } as Job, {
      workingdir: '/workingdir',
      logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
      logger: loggerMock as any,
      env: {},
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

    expect(spawn).toBeCalledWith(PackageManager.NPM, ['run', Hook.PRE_INSTALL], expect.anything());
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

    expect(spawn).not.toBeCalled();
  });
});
