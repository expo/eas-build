import assert from 'assert';
import path from 'path';

import spawnAsync from '@expo/spawn-async';
import semver from 'semver';

const repoRootPath = path.join(__dirname, '..');
const lerna = path.join(repoRootPath, 'node_modules/.bin/lerna');

interface LocalModule {
  name: string;
  version: string;
  private: boolean;
  location: string;
}

type ModuleToVersionMap = Record<string, string>;

async function runAsync(): Promise<void> {
  const maybeChangedFilesJsonRelativePath = process.argv[2] as string | undefined;
  const maybeChangedFilesJsonAbsolutePath =
    maybeChangedFilesJsonRelativePath && path.join(repoRootPath, maybeChangedFilesJsonRelativePath);

  const publicLocalModules = await getPublicLocalModulesAsync();
  const modulesToBump = getModulesToBump(publicLocalModules, maybeChangedFilesJsonAbsolutePath);
  const currentPublishedVersions = await getCurrentPublishedVersionsAsync(modulesToBump);
  const nextVersions = getNextModuleVersions(modulesToBump, currentPublishedVersions);
  await setNewVersionsAsync(modulesToBump, nextVersions);
}

async function getPublicLocalModulesAsync(): Promise<LocalModule[]> {
  const allModules: LocalModule[] = JSON.parse(
    (
      await spawnAsync(lerna, ['ls', '--toposort', '--json'], {
        stdio: ['inherit', 'pipe', 'inherit'],
      })
    ).stdout
  );
  return allModules.filter((m) => !m.private);
}

function getModulesToBump(modules: LocalModule[], changedFilesJsonPath?: string): LocalModule[] {
  if (!changedFilesJsonPath) {
    return modules;
  }
  const changedModulePaths = getChangedModulePaths(changedFilesJsonPath);
  return modules.filter((m) =>
    changedModulePaths.some((changedModulePath) => m.location.endsWith(changedModulePath))
  );
}

function getChangedModulePaths(changedFilesJsonPath: string): string[] {
  const changedFiles: string[] = require(changedFilesJsonPath);
  const changedFilesInPackagesDir = changedFiles.filter((f) => f.startsWith('packages/'));
  const changedModulePaths = changedFilesInPackagesDir.map((f) => {
    const matched = f.match(/(packages\/[^/]+)\//);
    const moduleDirectory = matched?.[1];
    assert(moduleDirectory);
    return moduleDirectory;
  });
  return [...new Set(changedModulePaths)];
}

async function getCurrentPublishedVersionsAsync(
  modules: LocalModule[]
): Promise<ModuleToVersionMap> {
  const versions = await Promise.all(modules.map((m) => checkLatestVersionAsync(m.name)));
  const result: ModuleToVersionMap = {};
  for (let i = 0; i < modules.length; i++) {
    result[modules[i].name] = versions[i];
  }
  return result;
}

async function checkLatestVersionAsync(moduleName: string): Promise<string> {
  const data: { name: string; version: string } = JSON.parse(
    (
      await spawnAsync('npm', ['info', moduleName, '--json'], {
        stdio: ['inherit', 'pipe', 'inherit'],
      })
    ).stdout
  );
  if (data.name !== moduleName) {
    throw new Error(`The module name does not match: "${data.name}" != "${moduleName}`);
  }
  return data.version;
}

// TODO: choose next version based on the changelog
function getNextModuleVersions(
  _localModules: LocalModule[],
  currentVersions: ModuleToVersionMap
): ModuleToVersionMap {
  const nextVersions: ModuleToVersionMap = {};
  for (const [name, currentVersion] of Object.entries(currentVersions)) {
    // TODO: choose next version based on the changelog
    const nextVersion = semver.inc(currentVersion, 'patch');
    assert(nextVersion);
    nextVersions[name] = nextVersion;
  }
  return nextVersions;
}

async function setNewVersionsAsync(
  localModules: LocalModule[],
  nextVersions: ModuleToVersionMap
): Promise<void> {
  for (const m of localModules) {
    await spawnAsync('yarn', ['version', '--new-version', nextVersions[m.name]]);
  }
}

runAsync().catch((err) => {
  console.error({ err });
  process.exit(1);
});
