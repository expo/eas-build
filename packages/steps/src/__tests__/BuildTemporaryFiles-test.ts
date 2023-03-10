import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { BuildArtifactType } from '../BuildArtifacts.js';
import {
  cleanUpStepTemporaryDirectoriesAsync,
  cleanUpWorkflowTemporaryDirectoriesAsync,
  createTemporaryOutputsDirectoryAsync,
  findArtifactsByTypeAsync,
  saveArtifactToTemporaryDirectoryAsync,
  saveScriptToTemporaryFileAsync,
} from '../BuildTemporaryFiles.js';
import { BuildInternalError } from '../errors/BuildInternalError.js';

import { createMockContext } from './utils/context.js';
import { getErrorAsync } from './utils/error.js';

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

describe(saveArtifactToTemporaryDirectoryAsync, () => {
  const originalArtifactPath = path.join(os.tmpdir(), 'app.ipa');

  beforeEach(async () => {
    await fs.writeFile(originalArtifactPath, 'abc123');
  });
  afterEach(async () => {
    await fs.rm(originalArtifactPath);
  });

  it('can upload the application archive', async () => {
    const ctx = createMockContext();
    const artifactPath = await saveArtifactToTemporaryDirectoryAsync(
      ctx,
      BuildArtifactType.APPLICATION_ARCHIVE,
      originalArtifactPath
    );
    expect(artifactPath).not.toBe(originalArtifactPath);
    await expect(fs.readFile(artifactPath, 'utf-8')).resolves.toBe('abc123');
    expect(artifactPath.startsWith(os.tmpdir())).toBe(true);
  });
  it('can upload a build artifact', async () => {
    const ctx = createMockContext();
    const artifactPath = await saveArtifactToTemporaryDirectoryAsync(
      ctx,
      BuildArtifactType.BUILD_ARTIFACT,
      originalArtifactPath
    );
    expect(artifactPath).not.toBe(originalArtifactPath);
    await expect(fs.readFile(artifactPath, 'utf-8')).resolves.toBe('abc123');
    expect(artifactPath.startsWith(os.tmpdir())).toBe(true);
  });
  it('throws when trying to upload unsupported artifact type', async () => {
    const ctx = createMockContext();
    const error = await getErrorAsync<BuildInternalError>(async () =>
      saveArtifactToTemporaryDirectoryAsync(
        ctx,
        'unknown' as BuildArtifactType,
        originalArtifactPath
      )
    );
    expect(error).toBeInstanceOf(BuildInternalError);
    expect(error.message).toMatch(/Uploading artifacts of type "unknown" is not implemented/);
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

describe(findArtifactsByTypeAsync, () => {
  const originalArtifactPath1 = path.join(os.tmpdir(), 'app1.ipa');
  const originalArtifactPath2 = path.join(os.tmpdir(), 'app2.ipa');

  beforeEach(async () => {
    await fs.writeFile(originalArtifactPath1, 'abc123');
    await fs.writeFile(originalArtifactPath2, 'def456');
  });
  afterEach(async () => {
    await fs.rm(originalArtifactPath1);
    await fs.rm(originalArtifactPath2);
  });

  it('can find artifacts of type "application-archive"', async () => {
    const ctx = createMockContext();
    const artifactPath1 = await saveArtifactToTemporaryDirectoryAsync(
      ctx,
      BuildArtifactType.APPLICATION_ARCHIVE,
      originalArtifactPath1
    );
    const artifactPath2 = await saveArtifactToTemporaryDirectoryAsync(
      ctx,
      BuildArtifactType.APPLICATION_ARCHIVE,
      originalArtifactPath2
    );
    const result = await findArtifactsByTypeAsync(ctx, BuildArtifactType.APPLICATION_ARCHIVE);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(artifactPath1);
    expect(result[1]).toBe(artifactPath2);
  });
  it('can find artifacts of type "build-artifact"', async () => {
    const ctx = createMockContext();
    await saveArtifactToTemporaryDirectoryAsync(
      ctx,
      BuildArtifactType.APPLICATION_ARCHIVE,
      originalArtifactPath1
    );
    const artifactPath2 = await saveArtifactToTemporaryDirectoryAsync(
      ctx,
      BuildArtifactType.BUILD_ARTIFACT,
      originalArtifactPath2
    );
    const result = await findArtifactsByTypeAsync(ctx, BuildArtifactType.BUILD_ARTIFACT);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(artifactPath2);
  });
  it('throws when trying to find unsupported artifact type', async () => {
    const ctx = createMockContext();
    await expect(findArtifactsByTypeAsync(ctx, 'unknown' as BuildArtifactType)).rejects.toThrow(
      BuildInternalError
    );
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

describe(cleanUpWorkflowTemporaryDirectoriesAsync, () => {
  const originalArtifactPath = path.join(os.tmpdir(), 'app.ipa');

  beforeEach(async () => {
    await fs.writeFile(originalArtifactPath, 'abc123');
  });
  afterEach(async () => {
    await fs.rm(originalArtifactPath);
  });

  it('removes the workflow temporary directories', async () => {
    const ctx = createMockContext();
    const artifactPath = await saveArtifactToTemporaryDirectoryAsync(
      ctx,
      BuildArtifactType.APPLICATION_ARCHIVE,
      originalArtifactPath
    );
    await expect(fs.stat(artifactPath)).resolves.toBeTruthy();
    await cleanUpWorkflowTemporaryDirectoriesAsync(ctx);
    await expect(fs.stat(artifactPath)).rejects.toThrow(/no such file or directory/);
  });

  it(`doesn't fail if temporary directories don't exist`, async () => {
    const ctx = createMockContext();
    await expect(cleanUpWorkflowTemporaryDirectoriesAsync(ctx)).resolves.not.toThrow();
  });
});
