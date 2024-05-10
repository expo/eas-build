import path from 'path';

import spawn from '@expo/turtle-spawn';
import fs from 'fs-extra';
import { ArchiveSource, ArchiveSourceType, Job } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import downloadFile from '@expo/downloader';

import { BuildContext } from '../context';

export async function prepareProjectSourcesAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  destinationDirectory = ctx.buildDirectory
): Promise<void> {
  if (ctx.job.projectArchive.type === ArchiveSourceType.GCS) {
    throw new Error('GCS project sources should be resolved earlier to url');
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.PATH) {
    await prepareProjectSourcesLocallyAsync(ctx, ctx.job.projectArchive.path, destinationDirectory); // used in eas build --local
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.URL) {
    await downloadAndUnpackProjectFromTarGzAsync(
      ctx,
      ctx.job.projectArchive.url,
      destinationDirectory
    );
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.GIT) {
    await shallowCloneRepositoryAsync({
      logger: ctx.logger,
      archiveSource: ctx.job.projectArchive,
      destinationDirectory,
    });
  }
}

async function shallowCloneRepositoryAsync({
  logger,
  archiveSource,
  destinationDirectory,
}: {
  logger: bunyan;
  archiveSource: ArchiveSource & { type: ArchiveSourceType.GIT };
  destinationDirectory: string;
}): Promise<void> {
  const { repositoryUrl } = archiveSource;
  try {
    await spawn('git', ['init'], { cwd: destinationDirectory });
    await spawn('git', ['remote', 'add', 'origin', repositoryUrl], { cwd: destinationDirectory });

    const { gitRef, gitCommitHash } = archiveSource;

    await spawn('git', ['fetch', 'origin', '--depth', '1', '--no-tags', gitCommitHash], {
      cwd: destinationDirectory,
    });

    await spawn('git', ['checkout', gitCommitHash], { cwd: destinationDirectory });

    // If we have a gitRef, we try to add it to the repo.
    if (gitRef) {
      const { name, type } = getStrippedBranchOrTagName(gitRef);
      switch (type) {
        // If the gitRef is for a tag, we add a lightweight tag to current commit.
        case 'tag': {
          await spawn('git', ['tag', name], { cwd: destinationDirectory });
          break;
        }
        // gitRef for a branch may come as:
        // - qualified ref (e.g. refs/heads/feature/add-icon), detected as "branch" for a push,
        // - unqualified ref (e.g. feature/add-icon), detected as "other" for a pull request.
        case 'branch':
        case 'other': {
          await spawn('git', ['checkout', '-b', name], { cwd: destinationDirectory });
          break;
        }
      }
    }
  } catch (err: any) {
    const sanitizedUrl = getSanitizedGitUrl(repositoryUrl);
    if (sanitizedUrl) {
      logger.error(`Failed to clone git repository: ${sanitizedUrl}.`);
    } else {
      logger.error('Failed to clone git repository.');
    }
    logger.error(err.stderr);
    throw err;
  }
}

function getSanitizedGitUrl(maybeGitUrl: string): string | null {
  try {
    const url = new URL(maybeGitUrl);
    if (url.password) {
      url.password = '*******';
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function downloadAndUnpackProjectFromTarGzAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  projectArchiveUrl: string,
  destinationDirectory: string
): Promise<void> {
  const projectTarball = path.join(ctx.workingdir, 'project.tar.gz');
  try {
    await downloadFile(projectArchiveUrl, projectTarball, { retry: 3 });
  } catch (err: any) {
    ctx.reportError?.('Failed to download project archive', err, {
      extras: { buildId: ctx.env.EAS_BUILD_ID },
    });
    throw err;
  }

  await unpackTarGzAsync({
    destination: destinationDirectory,
    source: projectTarball,
    logger: ctx.logger,
  });
}

async function prepareProjectSourcesLocallyAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  projectArchivePath: string,
  destinationDirectory: string
): Promise<void> {
  const projectTarball = path.join(ctx.workingdir, 'project.tar.gz');
  await fs.copy(projectArchivePath, projectTarball);

  await unpackTarGzAsync({
    destination: destinationDirectory,
    source: projectTarball,
    logger: ctx.logger,
  });
}

async function unpackTarGzAsync({
  logger,
  source,
  destination,
}: {
  logger: bunyan;
  source: string;
  destination: string;
}): Promise<void> {
  await spawn('tar', ['-C', destination, '--strip-components', '1', '-zxf', source], {
    logger,
  });
}

function getStrippedBranchOrTagName(ref: string): {
  name: string;
  type: 'branch' | 'tag' | 'other';
} {
  const branchRegex = /(\/?refs)?\/?heads\/(.+)/;
  const branchMatch = ref.match(branchRegex);

  if (branchMatch) {
    return {
      name: branchMatch[2],
      type: 'branch',
    };
  }

  const tagRegex = /(\/?refs)?\/?tags\/(.+)/;
  const tagMatch = ref.match(tagRegex);

  if (tagMatch) {
    return {
      name: tagMatch[2],
      type: 'tag',
    };
  }

  return {
    name: ref,
    type: 'other',
  };
}
