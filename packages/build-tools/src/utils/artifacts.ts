import path from 'path';

import fs from 'fs-extra';
import fg from 'fast-glob';
import { bunyan } from '@expo/logger';
import { ManagedArtifactType, Job, BuildJob } from '@expo/eas-build-job';

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
  const files = path.isAbsolute(patternOrPath)
    ? (await fs.pathExists(patternOrPath))
      ? [patternOrPath]
      : []
    : await fg(patternOrPath, { cwd: rootDir, onlyFiles: false });
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

  return files.map((filePath) => {
    // User may provide an absolute path as input in which case
    // fg will return an absolute path.
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    // User may also provide a relative path in which case
    // fg will return a path relative to rootDir.
    return path.join(rootDir, filePath);
  });
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
  ctx: BuildContext<BuildJob>,
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
    const artifactsSizes = await getArtifactsSizes(buildArtifacts);
    logger.info(`Build artifacts:`);
    for (const [path, size] of Object.entries(artifactsSizes)) {
      logger.info(`  - ${path} (${formatBytes(size)})`);
    }
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
  const artifactsSizes = await getArtifactsSizes(applicationArchives);
  logger.info(`Application archives:`);
  for (const [path, size] of Object.entries(artifactsSizes)) {
    logger.info(`  - ${path} (${formatBytes(size)})`);
  }
  logger.info('Uploading application archive...');
  await ctx.uploadArtifact({
    artifact: {
      type: ManagedArtifactType.APPLICATION_ARCHIVE,
      paths: applicationArchives,
    },
    logger,
  });
}

async function getArtifactsSizes(artifacts: string[]): Promise<Record<string, number>> {
  const artifactsSizes: Record<string, number> = {};
  await Promise.all(
    artifacts.map(async (artifact) => {
      const stat = await fs.stat(artifact);
      if (!stat.isDirectory()) {
        artifactsSizes[artifact] = stat.size;
      } else {
        const files = await fg('**/*', { cwd: artifact, onlyFiles: true });
        let size = 0;
        for (const file of files) {
          size += (await fs.stat(path.join(artifact, file))).size;
        }
        artifactsSizes[artifact] = size;
      }
    })
  );
  return artifactsSizes;
}

// same as in
// https://github.com/expo/eas-cli/blob/f0e3b648a1634266e7d723bd49a84866ab9b5801/packages/eas-cli/src/utils/files.ts#L33-L60
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return `0`;
  }
  let multiplier = 1;
  if (bytes < 1024 * multiplier) {
    return `${Math.floor(bytes)} B`;
  }
  multiplier *= 1024;
  if (bytes < 102.4 * multiplier) {
    return `${(bytes / multiplier).toFixed(1)} KB`;
  }
  if (bytes < 1024 * multiplier) {
    return `${Math.floor(bytes / 1024)} KB`;
  }
  multiplier *= 1024;
  if (bytes < 102.4 * multiplier) {
    return `${(bytes / multiplier).toFixed(1)} MB`;
  }
  if (bytes < 1024 * multiplier) {
    return `${Math.floor(bytes / multiplier)} MB`;
  }
  multiplier *= 1024;
  if (bytes < 102.4 * multiplier) {
    return `${(bytes / multiplier).toFixed(1)} GB`;
  }
  return `${Math.floor(bytes / 1024)} GB`;
}
