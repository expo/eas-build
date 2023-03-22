import fs from 'fs/promises';
import os from 'os';

import {
  cleanUpStepTemporaryDirectoriesAsync,
  createTemporaryOutputsDirectoryAsync,
  saveScriptToTemporaryFileAsync,
} from '../BuildTemporaryFiles.js';

import { createMockContext } from './utils/context.js';

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
    await expect(fs.readFile(scriptPath, 'utf-8')).resolves.toBe(contents);
  });
});

describe(createTemporaryOutputsDirectoryAsync, () => {
  it('creates a temporary directory for output values', async () => {
    const ctx = createMockContext();
    const outputsPath = await createTemporaryOutputsDirectoryAsync(ctx, 'foo');
    await expect(fs.stat(outputsPath)).resolves.not.toThrow();
  });
  it('creates a temporary directory inside os.tmpdir()', async () => {
    const ctx = createMockContext();
    const outputsPath = await createTemporaryOutputsDirectoryAsync(ctx, 'foo');
    expect(outputsPath.startsWith(os.tmpdir())).toBe(true);
  });
});

describe(cleanUpStepTemporaryDirectoriesAsync, () => {
  it('removes the step temporary directories', async () => {
    const ctx = createMockContext();
    const scriptPath = await saveScriptToTemporaryFileAsync(ctx, 'foo', 'echo 123');
    const outputsPath = await createTemporaryOutputsDirectoryAsync(ctx, 'foo');
    await expect(fs.stat(scriptPath)).resolves.toBeTruthy();
    await expect(fs.stat(outputsPath)).resolves.toBeTruthy();
    await cleanUpStepTemporaryDirectoriesAsync(ctx, 'foo');
    await expect(fs.stat(scriptPath)).rejects.toThrow(/no such file or directory/);
    await expect(fs.stat(outputsPath)).rejects.toThrow(/no such file or directory/);
  });

  it(`doesn't fail if temporary directories don't exist`, async () => {
    const ctx = createMockContext();
    await expect(cleanUpStepTemporaryDirectoriesAsync(ctx, 'foo')).resolves.not.toThrow();
  });
});
