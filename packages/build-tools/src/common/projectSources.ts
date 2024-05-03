import path from 'path';

import spawn from '@expo/turtle-spawn';
import fs from 'fs-extra';
import nullthrows from 'nullthrows';
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

    let gitRef: string | null;
    let gitCommitHash: string;
    // If gitRef is provided, but gitCommitHash is not,
    // we're handling a legacy case - gitRef is the commit hash.
    // Otherwise we expect gitCommitHash to be present.
    if (archiveSource.gitRef && !archiveSource.gitCommitHash) {
      gitCommitHash = archiveSource.gitRef;
      gitRef = null;
    } else {
      gitCommitHash = nullthrows(archiveSource.gitCommitHash);
      gitRef = archiveSource.gitRef ?? null;
    }

    await spawn(
      'git',
      ['fetch', 'origin', '--depth', '1', '--no-tags', getGitRefSpec({ gitCommitHash, gitRef })],
      {
        cwd: destinationDirectory,
      }
    );

    await spawn('git', ['checkout', ...getGitRefCheckoutArgs({ gitCommitHash, gitRef })], {
      cwd: destinationDirectory,
    });
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

function getGitRefCheckoutArgs({
  gitCommitHash,
  gitRef,
}: {
  gitCommitHash: string;
  gitRef: string | null;
}): [commit: string, '-B', branch: string] | [ref: string] {
  // No ref provided, checkout the commit hash
  if (!gitRef) {
    return [gitCommitHash];
  }

  const { name, type } = getStrippedBranchOrTagName(gitRef);
  switch (type) {
    case 'branch':
      // We can check out a remote branch because we fetched it through the refspec.
      return [`refs/remotes/origin/${name}`, '-B', name];
    case 'tag':
      // We can check out a tag because we fetched it through the refspec.
      return [`refs/tags/${name}`];
    case 'other':
      // We checkout the commit and start a new branch.
      return [gitCommitHash, '-B', name];
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

function getGitRefSpec({
  gitCommitHash,
  gitRef,
}: {
  gitCommitHash: string;
  gitRef: string | null;
}): string {
  const { name, type } = getStrippedBranchOrTagName(gitRef ?? '');
  switch (type) {
    case 'branch':
      // By using a remote ref we also set the upstream.
      return `+${gitCommitHash}:refs/remotes/origin/${name}`;
    case 'tag':
      return `+${gitCommitHash}:refs/tags/${name}`;
    case 'other':
      // Checks out a new branch or falls back to FETCH_HEAD if name is empty.
      return `+${gitCommitHash}:${name}`;
  }
}
