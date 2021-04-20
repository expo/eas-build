import { vol } from 'memfs';

import { findPackagerRootDir } from '../project';

jest.mock('fs');

describe(findPackagerRootDir, () => {
  beforeEach(() => {
    vol.reset();
  });

  it('returns the workspace root if the current dir is a workspace', async () => {
    vol.fromJSON(
      {
        './package.json': JSON.stringify({
          workspaces: ['some-package', 'react-native-project'],
        }),
        './some-package/package.json': JSON.stringify({
          name: 'some-package',
        }),
        './react-native-project/package.json': JSON.stringify({
          name: 'react-native-project',
        }),
      },
      '/repo'
    );

    const rootDir = findPackagerRootDir('/repo/react-native-project');
    expect(rootDir).toBe('/repo');
  });

  it(
    `returns the current dir if it's not a workspace` +
      ` (package.json exists in root dir and contains workspaces field)`,
    async () => {
      vol.fromJSON(
        {
          './package.json': JSON.stringify({
            workspaces: ['some-package'],
          }),
          './some-package/package.json': JSON.stringify({
            name: 'some-package',
          }),
          './react-native-project/package.json': JSON.stringify({
            name: 'react-native-project',
          }),
        },
        '/repo'
      );

      const rootDir = findPackagerRootDir('/repo/react-native-project');
      expect(rootDir).toBe('/repo/react-native-project');
    }
  );

  it(
    `returns the current dir if it's not a workspace` +
      ` (package.json exists in root dir and does not contain workspaces field)`,
    async () => {
      vol.fromJSON(
        {
          './package.json': JSON.stringify({}),
          './some-package/package.json': JSON.stringify({
            name: 'some-package',
          }),
          './react-native-project/package.json': JSON.stringify({
            name: 'react-native-project',
          }),
        },
        '/repo'
      );

      const rootDir = findPackagerRootDir('/repo/react-native-project');
      expect(rootDir).toBe('/repo/react-native-project');
    }
  );

  it(`returns the current dir if it's not a workspace (package.json does not exist in root dir) `, async () => {
    vol.fromJSON(
      {
        './some-package/package.json': JSON.stringify({
          name: 'some-package',
        }),
        './react-native-project/package.json': JSON.stringify({
          name: 'react-native-project',
        }),
      },
      '/repo'
    );

    const rootDir = findPackagerRootDir('/repo/react-native-project');
    expect(rootDir).toBe('/repo/react-native-project');
  });
});
