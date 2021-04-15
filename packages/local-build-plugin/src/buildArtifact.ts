import path from 'path';

import { BuildContext } from '@expo/build-tools';
import { Job } from '@expo/eas-build-job';
import fs from 'fs-extra';
import tar from 'tar';

import config from './config';

export async function prepareBuildArtifact(
  ctx: BuildContext<Job>,
  artifactPaths: string[]
): Promise<string | undefined> {
  ctx.logger.info({ phase: 'PREPARE_ARTIFACTS' }, 'Archiving artifacts');
  let suffix;
  let localPath;
  if (artifactPaths.length === 1 && !(await fs.lstat(artifactPaths[0])).isDirectory()) {
    [localPath] = artifactPaths;
    suffix = path.extname(artifactPaths[0]);
  } else {
    const parentDir = artifactPaths.reduce(
      (acc, item) => getCommonParentDir(acc, item),
      artifactPaths[0]
    );
    const relativePathsToArchive = artifactPaths.map((absolute) =>
      path.relative(parentDir, absolute)
    );

    const archivePath = path.join(config.workingdir, 'artifacts.tar.gz');
    await tar.c(
      {
        gzip: true,
        file: archivePath,
        cwd: parentDir,
      },
      relativePathsToArchive
    );
    suffix = '.tar.gz';
    localPath = archivePath;
  }
  const artifactName = `build-${formatDateForFilename(new Date())}${suffix}`;
  const destPath = path.join(config.artifactsDir, artifactName);
  await fs.copy(localPath, destPath);
  ctx.logger.info({ phase: 'PREPARE_ARTIFACTS' }, `Writing artifacts to ${destPath}`);
  return destPath;
}

function getCommonParentDir(path1: string, path2: string): string {
  const normalizedPath1 = path.normalize(path1);
  const normalizedPath2 = path.normalize(path2);
  let current = path.dirname(normalizedPath1);
  while (current !== '/') {
    if (normalizedPath2.startsWith(current)) {
      return current;
    }
    current = path.dirname(current);
  }
  return '/';
}

function formatDateForFilename(date: Date): string {
  return `${date.getDay()}-${date.getMonth()}-${date.getFullYear()}-${date.getHours()}:${date.getMinutes()}`;
}
