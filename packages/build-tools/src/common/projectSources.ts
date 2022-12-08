import path from 'path';

import spawn from '@expo/turtle-spawn';
import fs from 'fs-extra';
import { ArchiveSourceType, Job } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import downloadFile from '@expo/downloader';

import { BuildContext } from '../context';

export async function prepareProjectSourcesAsync<TJob extends Job>(
  ctx: BuildContext<TJob>
): Promise<void> {
  if ([ArchiveSourceType.S3, ArchiveSourceType.GCS].includes(ctx.job.projectArchive.type)) {
    throw new Error('GCS and S3 project sources should be resolved earlier to url');
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.PATH) {
    await prepareProjectSourcesLocallyAsync(ctx, ctx.job.projectArchive.path); // used in eas build --local
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.URL) {
    await downloadAndUnpackProjectFromTarGzAsync(ctx, ctx.job.projectArchive.url);
  } else if (ctx.job.projectArchive.type === ArchiveSourceType.GIT) {
    await shallowCloneRepositoryAsync(
      ctx,
      ctx.job.projectArchive.repositoryUrl,
      ctx.job.projectArchive.gitRef
    );
  }
}

async function shallowCloneRepositoryAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  projectArchiveUrl: string,
  gitRef: string
): Promise<void> {
  try {
    await spawn('git', ['init'], { cwd: ctx.buildDirectory });
    await spawn('git', ['remote', 'add', 'origin', projectArchiveUrl], { cwd: ctx.buildDirectory });
    await spawn('git', ['fetch', 'origin', '--depth', '1', gitRef], { cwd: ctx.buildDirectory });
    await spawn('git', ['checkout', gitRef], { cwd: ctx.buildDirectory });
  } catch (err: any) {
    ctx.logger.error('Failed to clone git repository.');
    ctx.logger.error(err.stderr);
    throw err;
  }
}

async function downloadAndUnpackProjectFromTarGzAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  projectArchiveUrl: string
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
    destination: ctx.buildDirectory,
    source: projectTarball,
    logger: ctx.logger,
  });
}

async function prepareProjectSourcesLocallyAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  projectArchivePath: string
): Promise<void> {
  const projectTarball = path.join(ctx.workingdir, 'project.tar.gz');
  await fs.copy(projectArchivePath, projectTarball);

  await unpackTarGzAsync({
    destination: ctx.buildDirectory,
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
