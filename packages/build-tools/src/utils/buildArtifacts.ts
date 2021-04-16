import path from 'path';

import fs from 'fs-extra';
import fg from 'fast-glob';
import { bunyan } from '@expo/logger';

export async function findBuildArtifacts(
  rootDir: string,
  patternOrPath: string,
  buildLogger: bunyan
): Promise<string[]> {
  const files = await fg(patternOrPath, { cwd: rootDir, onlyFiles: false });
  if (files.length === 0) {
    if (fg.isDynamicPattern(patternOrPath)) {
      throw new Error(`There are no files matching pattern: ${patternOrPath}`);
    } else {
      await logMissingFileError(path.join(rootDir, patternOrPath), buildLogger);
      throw new Error(`No such file or directory ${patternOrPath}`);
    }
  }
  return files.map((relativePath) => path.join(rootDir, relativePath));
}

export async function findSingleBuildArtifact(
  rootDir: string,
  patternOrPath: string,
  buildLogger: bunyan
): Promise<string> {
  const files = await findBuildArtifacts(rootDir, patternOrPath, buildLogger);
  if (files.length > 1) {
    buildLogger.warn({ files }, `Multiple artifacts found, uploading ${files[0]}.`);
    // TODO: report to sentry
  }
  return files[0];
}

async function logMissingFileError(artifactPath: string, buildLogger: bunyan): Promise<void> {
  let currentPath = artifactPath;
  while (!(await fs.pathExists(currentPath))) {
    currentPath = path.resolve(currentPath, '..');
  }
  if (currentPath === path.resolve(currentPath, '..')) {
    buildLogger.error(`There is no such file or directory "${artifactPath}".`);
    return;
  }
  const dirContent = await fs.readdir(currentPath);
  if (dirContent.length === 0) {
    buildLogger.error(
      `There is no such file or directory "${artifactPath}". Directory "${currentPath}" is empty.`
    );
  } else {
    buildLogger.error(
      `There is no such file or directory "${artifactPath}". Directory "${currentPath}" contains [${dirContent.join(
        ', '
      )}].`
    );
  }
}
