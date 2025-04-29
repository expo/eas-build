import path from 'path';

import downloadFile from '@expo/downloader';
import { ArchiveSource, ArchiveSourceType, Job } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import spawn from '@expo/turtle-spawn';
import fs from 'fs-extra';
import { Response } from 'node-fetch';

import { BuildContext } from '../context';
import { turtleFetch } from '../utils/turtleFetch';

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
    const { repositoryUrl: archiveRepositoryUrl } = ctx.job.projectArchive;
    const repositoryUrl = archiveRepositoryUrl ?? (await generateGithubUrlAsync(ctx));
    await shallowCloneRepositoryAsync({
      repositoryUrl,
      logger: ctx.logger,
      archiveSource: ctx.job.projectArchive,
      destinationDirectory,
    });
  }
}

async function generateGithubUrlAsync<TJob extends Job>(ctx: BuildContext<TJob>): Promise<string> {
  const logger = ctx.logger;
  const expoApiV2BaseUrl = ctx.env.__API_SERVER_URL;

  const accessToken = ctx.env.EXPO_TOKEN;

  const body = {
    type: 'build',
    buildId: ctx.env.EAS_BUILD_ID,
  };

  if (!accessToken) {
    throw new Error('Failed to generate GitHub URL params, no access token');
  }

  let response: Response;
  try {
    response = await turtleFetch(
      new URL(
        '--/api/v2/github/scoped-generate-github-repository-url',
        expoApiV2BaseUrl
      ).toString(),
      'POST',
      {
        json: body,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 20000,
        shouldThrowOnNotOk: false,
        logger,
        retries: 2,
      }
    );
  } catch {
    throw new Error('Failed to generate GitHub URL params, request failed');
  }
  if (response.status !== 200) {
    throw new Error(
      `Failed to generate GitHub URL params, status code: ${response.status} ${await response.text()}`
    );
  }

  const responseJson = await response.json();
  return responseJson.data.repositoryUrl;
}

async function shallowCloneRepositoryAsync({
  repositoryUrl,
  logger,
  archiveSource,
  destinationDirectory,
}: {
  repositoryUrl: string;
  logger: bunyan;
  archiveSource: ArchiveSource & { type: ArchiveSourceType.GIT };
  destinationDirectory: string;
}): Promise<void> {
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
