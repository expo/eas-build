import path from 'path';

import spawn from '@expo/turtle-spawn';
import fs from 'fs-extra';
import { ArchiveSourceType, Job } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import downloadFile from '@expo/downloader';
import { z } from 'zod';
import { asyncResult } from '@expo/results';
import nullthrows from 'nullthrows';
import { graphql } from 'gql.tada';

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

  const uploadResult = await asyncResult(
    uploadProjectMetadataAsync(ctx, { projectDirectory: destinationDirectory })
  );
  if (!uploadResult.ok) {
    ctx.logger.warn(`Failed to upload project metadata: ${uploadResult.reason}`);
  }
}

async function fetchRepositoryUrlAsync(ctx: BuildContext<Job>): Promise<string> {
  const taskId = nullthrows(ctx.env.EAS_BUILD_ID, 'EAS_BUILD_ID is not set');
  const expoApiServerURL = nullthrows(ctx.env.__API_SERVER_URL, '__API_SERVER_URL is not set');
  const robotAccessToken = nullthrows(
    ctx.job.secrets?.robotAccessToken,
    'robot access token is not set'
  );

  const response = await turtleFetch(
    new URL(`/v2/github/fetch-github-repository-url`, expoApiServerURL).toString(),
    'POST',
    {
      json: { taskId },
      headers: {
        Authorization: `Bearer ${robotAccessToken}`,
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

async function uploadProjectMetadataAsync(
  ctx: BuildContext<Job>,
  { projectDirectory }: { projectDirectory: string }
): Promise<void> {
  if (!ctx.job.platform) {
    // Not a build job, skip.
    return;
  } else if (
    ctx.job.projectArchive.type === ArchiveSourceType.GCS &&
    ctx.job.projectArchive.metadataLocation
  ) {
    // Build already has project metadata, skip.
    return;
  }

  const files: string[] = [];

  const directoriesToScan: { dir: string; relativePath: string }[] = [
    { dir: projectDirectory, relativePath: '' },
  ];

  while (directoriesToScan.length > 0) {
    const { dir, relativePath } = directoriesToScan.shift()!;

    if (relativePath === '.git') {
      // Do not include whole `.git` directory in the archive, just that it exists.
      files.push('.git/...');
      continue;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativeFilePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        directoriesToScan.push({ dir: fullPath, relativePath: relativeFilePath });
      } else {
        files.push(relativeFilePath);
      }
    }
  }
  const sortedFiles = files
    .map(
      // Prepend entries with "project/"
      (f) => path.join('project', f)
    )
    .sort(); // Sort for consistent ordering

  const result = await ctx.graphqlClient
    .mutation(
      graphql(`
        mutation {
          uploadSession {
            createUploadSession(type: EAS_BUILD_GCS_PROJECT_METADATA)
          }
        }
      `),
      {}
    )
    .toPromise();

  if (result.error) {
    throw result.error;
  }

  const uploadSession = result.data!.uploadSession.createUploadSession as {
    url: string;
    bucketKey: string;
    headers: Record<string, string>;
  };

  await fetch(uploadSession.url, {
    method: 'PUT',
    body: JSON.stringify({ archiveContent: sortedFiles }),
    headers: uploadSession.headers,
  });

  const updateMetadataResult = await ctx.graphqlClient
    .mutation(
      graphql(`
        mutation UpdateTurtleBuildMetadataMutation(
          $buildId: ID!
          $projectMetadataFile: ProjectMetadataFileInput!
        ) {
          build {
            updateBuildMetadata(
              buildId: $buildId
              metadata: { projectMetadataFile: $projectMetadataFile }
            ) {
              id
            }
          }
        }
      `),
      {
        buildId: ctx.env.EAS_BUILD_ID,
        projectMetadataFile: {
          type: 'GCS',
          bucketKey: uploadSession.bucketKey,
        },
      }
    )
    .toPromise();

  if (updateMetadataResult.error) {
    throw updateMetadataResult.error;
  }
}
