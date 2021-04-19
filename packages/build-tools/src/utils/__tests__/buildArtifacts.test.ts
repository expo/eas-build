import { vol } from 'memfs';
import fs from 'fs-extra';

import { findBuildArtifacts } from '../buildArtifacts';

jest.mock('fs');

describe(findBuildArtifacts, () => {
  beforeEach(async () => {
    vol.reset();
  });

  test('with correct path', async () => {
    await fs.mkdirp('/dir1/dir2/dir3/dir4');
    await fs.writeFile('/dir1/dir2/dir3/dir4/file', Buffer.from('some content'));
    const loggerMock = {
      info: jest.fn(),
      error: jest.fn(),
    };
    const paths = await findBuildArtifacts('/dir1/dir2/dir3/dir4/', 'file', loggerMock as any);
    expect(loggerMock.error).toHaveBeenCalledTimes(0);
    expect(paths.length).toBe(1);
    expect(paths[0]).toBe('/dir1/dir2/dir3/dir4/file');
  });

  test('with glob pattern', async () => {
    await fs.mkdirp('/dir1/dir2/dir3/dir4');
    await fs.writeFile('/dir1/dir2/dir3/dir4/file.aab', Buffer.from('some content'));
    await fs.writeFile('/dir1/dir2/dir3/dir4/file-release.aab', Buffer.from('some content'));
    const loggerMock = {
      info: jest.fn(),
      error: jest.fn(),
    };
    const paths = await findBuildArtifacts(
      '/dir1/dir2/dir3/dir4/',
      'file{,-release}.aab',
      loggerMock as any
    );
    expect(loggerMock.error).toHaveBeenCalledTimes(0);
    expect(paths.length).toBe(2);
  });

  test('with missing file in empty directory', async () => {
    await fs.mkdirp('/dir1/dir2/dir3');
    let errMsg = '';
    const loggerMock = {
      info: jest.fn(),
      error: jest.fn().mockImplementation((msg) => {
        errMsg = msg;
      }),
    };
    await expect(
      findBuildArtifacts('/dir1/dir2/dir3/dir4/', 'file', loggerMock as any)
    ).rejects.toThrow();
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(errMsg).toEqual(
      'There is no such file or directory "/dir1/dir2/dir3/dir4/file". Directory "/dir1/dir2/dir3" is empty.'
    );
  });

  test('with missing file in not empty directory', async () => {
    await fs.mkdirp('/dir1/dir2/dir3/otherdir1');
    await fs.writeFile('/dir1/dir2/dir3/otherfile1', 'content');
    await fs.mkdirp('/dir1/dir2/dir3/otherdir2');
    let errMsg = '';
    const loggerMock = {
      info: jest.fn(),
      error: jest.fn().mockImplementation((msg) => {
        errMsg = msg;
      }),
    };
    await expect(
      findBuildArtifacts('/dir1/dir2/dir3/dir4/', 'file', loggerMock as any)
    ).rejects.toThrow();
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(errMsg).toEqual(
      'There is no such file or directory "/dir1/dir2/dir3/dir4/file". Directory "/dir1/dir2/dir3" contains [otherdir1, otherdir2, otherfile1].'
    );
  });

  test('when checks up root directory', async () => {
    await fs.mkdirp('/');
    let errMsg = '';
    const loggerMock = {
      info: jest.fn(),
      error: jest.fn().mockImplementation((msg) => {
        errMsg = msg;
      }),
    };
    await expect(
      findBuildArtifacts('/dir1/dir2/dir3/dir4/', 'file', loggerMock as any)
    ).rejects.toThrow();
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    expect(errMsg).toEqual('There is no such file or directory "/dir1/dir2/dir3/dir4/file".');
  });
});
