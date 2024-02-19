import path from 'path';

import fs from 'fs-extra';
import fg from 'fast-glob';
import { bunyan } from '@expo/logger';
import { ManagedArtifactType, Job } from '@expo/eas-build-job';

import { BuildContext } from '../context';

export class FindArtifactsError extends Error {}

export async function findArtifacts({
  rootDir,
  patternOrPath,
  logger,
}: {
  rootDir: string;
  patternOrPath: string;
  /** If provided, will log error suggesting possible files to upload. */
  logger: bunyan | null;
}): Promise<string[]> {
  const files = await fg(patternOrPath, { cwd: rootDir, onlyFiles: false });
  if (files.length === 0) {
    if (fg.isDynamicPattern(patternOrPath)) {
      throw new FindArtifactsError(`There are no files matching pattern "${patternOrPath}"`);
    } else {
      if (logger) {
        await logMissingFileError(path.join(rootDir, patternOrPath), logger);
      }
      throw new FindArtifactsError(`No such file or directory ${patternOrPath}`);
    }
  }
  return files.map((relativePath) => path.join(rootDir, relativePath));
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

export async function maybeFindAndUploadBuildArtifacts(
  ctx: BuildContext<Job>,
  { logger }: { logger: bunyan }
): Promise<void> {
  if (!ctx.job.buildArtifactPaths || ctx.job.buildArtifactPaths.length === 0) {
    return;
  }
  try {
    const buildArtifacts = (
      await Promise.all(
        ctx.job.buildArtifactPaths.map((path) =>
          findArtifacts({
            rootDir: ctx.getReactNativeProjectDirectory(),
            patternOrPath: path,
            logger,
          })
        )
      )
    ).flat();
    logger.info(`Build artifacts: ${buildArtifacts.join(', ')}`);
    logger.info('Uploading build artifacts...');
    await ctx.uploadArtifact({
      artifact: {
        type: ManagedArtifactType.BUILD_ARTIFACTS,
        paths: buildArtifacts,
      },
      logger,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to upload build artifacts');
  }
}

export async function uploadApplicationArchive(
  ctx: BuildContext<Job>,
  {
    logger,
    patternOrPath,
    rootDir,
  }: {
    logger: bunyan;
    patternOrPath: string;
    rootDir: string;
  }
): Promise<void> {
  const applicationArchives = await findArtifacts({ rootDir, patternOrPath, logger });
  logger.info(`Application archives: ${applicationArchives.join(', ')}`);
  logger.info('Uploading application archive...');
  await ctx.uploadArtifact({
    artifact: {
      type: ManagedArtifactType.APPLICATION_ARCHIVE,
      paths: applicationArchives,
    },
    logger,
  });
}
