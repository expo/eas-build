import fs from 'fs';
import os from 'os';

import { createMockContext } from '../../../__tests__/utils/context.js';
import {
  cleanUpTemporaryDirectoriesAsync,
  createTemporaryOutputsDirectoryAsync,
  saveScriptToTemporaryFileAsync,
} from '../temporaryFiles.js';

describe(saveScriptToTemporaryFileAsync, () => {
  it('saves the script in a directory inside os.tmpdir()', async () => {
    const ctx = createMockContext();
    const scriptPath = await saveScriptToTemporaryFileAsync(ctx, 'foo', 'echo 123\necho 456');
    expect(scriptPath.startsWith(os.tmpdir())).toBe(true);
  });
  it('saves the script to a temporary file', async () => {
    const ctx = createMockContext();
    const contents = 'echo 123\necho 456';
    const scriptPath = await saveScriptToTemporaryFileAsync(ctx, 'foo', contents);
    await expect(fs.promises.readFile(scriptPath, 'utf-8')).resolves.toBe(contents);
  });
});

describe(createTemporaryOutputsDirectoryAsync, () => {
  it('creates a temporary directory for output values', async () => {
    const ctx = createMockContext();
    const outputsPath = await createTemporaryOutputsDirectoryAsync(ctx, 'foo');
    await expect(fs.promises.stat(outputsPath)).resolves.not.toThrow();
  });
  it('creates a temporary directory inside os.tmpdir()', async () => {
    const ctx = createMockContext();
    const outputsPath = await createTemporaryOutputsDirectoryAsync(ctx, 'foo');
    expect(outputsPath.startsWith(os.tmpdir())).toBe(true);
  });
});

describe(cleanUpTemporaryDirectoriesAsync, () => {
  it('removes the temporary directories', async () => {
    const ctx = createMockContext();
    const scriptPath = await saveScriptToTemporaryFileAsync(ctx, 'foo', 'echo 123');
    const outputsPath = await createTemporaryOutputsDirectoryAsync(ctx, 'foo');
    await expect(fs.promises.stat(scriptPath)).resolves.toBeTruthy();
    await expect(fs.promises.stat(outputsPath)).resolves.toBeTruthy();
    await cleanUpTemporaryDirectoriesAsync(ctx, 'foo');
    await expect(fs.promises.stat(scriptPath)).rejects.toThrow(/no such file or directory/);
    await expect(fs.promises.stat(outputsPath)).rejects.toThrow(/no such file or directory/);
  });
});
