import path from 'path';

import { vol } from 'memfs';
import fs from 'fs-extra';

import { resolvePackageManager } from '../packageManager';

jest.mock('fs');

const rootDir = '/working/dir';

describe(resolvePackageManager, () => {
  beforeEach(async () => {
    vol.reset();
    await fs.mkdirp(rootDir);
  });

  it('returns npm when no lockfiles exist', async () => {
    expect(resolvePackageManager(rootDir)).toBe('npm');
  });

  it('returns npm when only package-json.lock exist', async () => {
    await fs.writeFile(path.join(rootDir, 'package-lock.json'), 'content');
    expect(resolvePackageManager(rootDir)).toBe('npm');
  });

  it('returns yarn when only yarn.lock exists', async () => {
    await fs.writeFile(path.join(rootDir, 'yarn.lock'), 'content');
    expect(resolvePackageManager(rootDir)).toBe('yarn');
  });

  it('returns yarn when both lockfiles exists', async () => {
    await fs.writeFile(path.join(rootDir, 'yarn.lock'), 'content');
    await fs.writeFile(path.join(rootDir, 'package-lock.json'), 'content');
    expect(resolvePackageManager(rootDir)).toBe('yarn');
  });

  it('returns npm within a monorepo', async () => {
    await fs.writeFile(path.join(rootDir, 'package-lock.json'), 'content');
    await fs.writeJson(path.join(rootDir, 'package.json'), {
      name: 'monorepo',
      workspaces: ['packages/*'],
    });

    const nestedDir = path.join(rootDir, 'packages', 'expo-app');
    await fs.mkdirp(nestedDir);
    await fs.writeJson(path.join(nestedDir, 'package.json'), {
      name: '@monorepo/expo-app',
    });

    expect(resolvePackageManager(nestedDir)).toBe('npm');
  });

  it('returns yarn with an invalid monorepo', async () => {
    // this shouldn't be picked up, because our package.json doesn't define the workspace
    await fs.writeFile(path.join(rootDir, 'package-lock.json'), 'content');
    await fs.writeFile(path.join(rootDir, 'package.json'), 'invalidjson');

    const nestedDir = path.join(rootDir, 'packages', 'expo-app');
    await fs.mkdirp(nestedDir);
    await fs.writeFile(path.join(nestedDir, 'package.json'), 'content');

    expect(resolvePackageManager(nestedDir)).toBe('yarn');
  });
});
