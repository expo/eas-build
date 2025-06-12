import path from 'path';

import spawn from '@expo/turtle-spawn';
import fs from 'fs-extra';
import { ArchiveSourceType, Job } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import downloadFile from '@expo/downloader';
import { z } from 'zod';
import { asyncResult } from '@expo/results';
import nullthrows from 'nullthrows';

import { BuildContext } from '../context';
import { turtleFetch } from '../utils/turtleFetch';

import { shallowCloneRepositoryAsync } from './git';

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
    let repositoryUrl = ctx.job.projectArchive.repositoryUrl;
    try {
      repositoryUrl = await fetchRepositoryUrlAsync(ctx);
    } catch (err) {
      ctx.logger.error('Failed to refresh clone URL, falling back to the original one', err);
    }

    await shallowCloneRepositoryAsync({
      logger: ctx.logger,
      archiveSource: {
        ...ctx.job.projectArchive,
        repositoryUrl,
      },
      destinationDirectory,
    });
  }
}

async function fetchRepositoryUrlAsync(ctx: BuildContext<Job>): Promise<string> {
  const taskId = nullthrows(ctx.env.EAS_BUILD_ID, 'EAS_BUILD_ID is not set');
  const expoApiServerURL = nullthrows(ctx.env.__API_SERVER_URL, '__API_SERVER_URL is not set');
  const expoToken = nullthrows(ctx.env.EXPO_TOKEN, 'EXPO_TOKEN is not set');

  const response = await turtleFetch(
    new URL(`/v2/github/fetch-github-repository-url`, expoApiServerURL).toString(),
    'POST',
    {
      json: { taskId },
      headers: {
        Authorization: `Bearer ${expoToken}`,
      },
      timeout: 20000,
      retries: 3,
      logger: ctx.logger,
    }
  );

  if (!response.ok) {
    const textResult = await asyncResult(response.text());
    throw new Error(`Unexpected response from server (${response.status}): ${textResult.value}`);
  }

  const jsonResult = await asyncResult(response.json());
  if (!jsonResult.ok) {
    throw new Error(
      `Expected JSON response from server (${response.status}): ${jsonResult.reason}`
    );
  }

  const dataResult = z
    .object({
      data: z.object({
        repositoryUrl: z.string().url(),
      }),
    })
    .safeParse(jsonResult.value);
  if (!dataResult.success) {
    throw new Error(`Unexpected response from server (${response.status}): ${dataResult.error}`);
  }

  return dataResult.data.data.repositoryUrl;
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
