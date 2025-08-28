import assert from 'assert';

import { BuildContext, BuildContextOptions, LogBuffer } from '@expo/build-tools';
import { ManagedArtifactType, BuildPhaseStats, Job, Metadata, Platform } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';

import { Analytics } from './external/analytics';
import config from './config';
import { GCSCacheManager } from './CacheManager';
import sentry from './sentry';
import {
  uploadApplicationArchiveAsync,
  uploadBuildArtifactsAsync,
  uploadWithAnalyticsAsync,
  uploadWorkflowArtifactAsync,
} from './upload';
import { uploadXcodeBuildLogs } from './ios/xcodeLogs';
import { getBuildEnv } from './env';

export function createBuildContext<TJob extends Job>({
  job,
  logBuffer,
  analytics,
  metadata,
  projectId,
  buildId,
  buildLogger,
  reportBuildPhaseStatsFn,
}: {
  job: TJob;
  logBuffer: LogBuffer;
  analytics: Analytics;
  metadata: Metadata;
  projectId: string;
  buildId: string;
  buildLogger: bunyan;
  reportBuildPhaseStatsFn: (stats: BuildPhaseStats) => void;
}): BuildContext<TJob> {
  const env = getBuildEnv({ job, projectId, metadata, buildId });
  const childLogger = buildLogger.child({ buildId });

  const uploadArtifact: BuildContextOptions['uploadArtifact'] = async ({ artifact, logger }) => {
    const { paths, type } = artifact;

    switch (type) {
      case ManagedArtifactType.XCODE_BUILD_LOGS: {
        if (job.platform === Platform.IOS) {
          await uploadXcodeBuildLogs(logger, paths[0]);
          return null;
        }
        throw new Error('Uploading Xcode logs in non-iOS builds is not supported');
      }
      case ManagedArtifactType.APPLICATION_ARCHIVE: {
        assert(job.platform, 'Uploading application archives outside of builds is not supported.');
        return await uploadWithAnalyticsAsync(
          () => uploadApplicationArchiveAsync(ctx, { artifactPaths: paths, buildId, logger }),
          analytics
        );
      }
      case ManagedArtifactType.BUILD_ARTIFACTS: {
        assert(job.platform, 'Uploading build artifacts outside of builds is not supported.');
        return await uploadWithAnalyticsAsync(
          () => uploadBuildArtifactsAsync(ctx, { artifactPaths: paths, buildId, logger }),
          analytics
        );
      }
      default: {
        await uploadWithAnalyticsAsync(
          () =>
            uploadWorkflowArtifactAsync(ctx, {
              artifactPaths: paths,
              logger,
              name: artifact.name,
            }),
          analytics
        );
        return null;
      }
    }
  };

  const ctx = new BuildContext<TJob>(job, {
    workingdir: config.workingdir,
    logger: childLogger,
    logBuffer,
    env,
    uploadArtifact,
    reportError: (msg, err, { tags, extras } = {}) => {
      sentry.handleError(msg, err, { tags, extras });
    },
    cacheManager: new GCSCacheManager(),
    metadata,
    reportBuildPhaseStats: reportBuildPhaseStatsFn,
  });
  return ctx;
}
