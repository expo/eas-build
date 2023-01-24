import fs from 'fs';
import os from 'os';

import { createMockContext } from '../../__tests__/utils/context.js';
import { cleanUpTemporaryDirAsync, saveScriptToTemporaryFileAsync } from '../scripts.js';

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

describe(cleanUpTemporaryDirAsync, () => {
  it('removes the temporary directory for scripts', async () => {
    const ctx = createMockContext();
    const scriptPath = await saveScriptToTemporaryFileAsync(ctx, 'foo', 'echo 123');
    await expect(fs.promises.stat(scriptPath)).resolves.toBeTruthy();
    await cleanUpTemporaryDirAsync(ctx);
    await expect(fs.promises.stat(scriptPath)).rejects.toThrow(/no such file or directory/);
  });
});
