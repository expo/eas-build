import { Ios, Platform } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { ArtifactType } from '../../../context';
import { findArtifacts } from '../../../utils/artifacts';
import { findXcodeBuildLogsPathAsync } from '../../../ios/xcodeBuildLogs';
import { CustomBuildContext } from '../../../customBuildContext';

export function createFindAndUploadBuildArtifactsBuildFunction(
  ctx: CustomBuildContext
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'find_and_upload_build_artifacts',
    name: 'Find and upload build artifacts',
    fn: async (stepCtx) => {
      const { logger } = stepCtx;
      const applicationArchivePatternOrPath =
        ctx.job.platform === Platform.ANDROID
          ? ctx.job.applicationArchivePath ?? 'android/app/build/outputs/**/*.{apk,aab}'
          : resolveIosArtifactPath(ctx.job);
      const applicationArchives = await findArtifacts(
        stepCtx.workingDirectory,
        applicationArchivePatternOrPath,
        logger
      );
      logger.info(
        `Application archive${
          applicationArchives.length > 1 ? 's' : ''
        }: ${applicationArchives.join(', ')}`
      );
      const buildArtifacts = (
        await Promise.all(
          (ctx.job.buildArtifactPaths ?? []).map((path) =>
            findArtifacts(ctx.projectTargetDirectory, path, logger)
          )
        )
      ).flat();
      if (buildArtifacts.length > 0) {
        logger.info(`Found additional build artifacts: ${buildArtifacts.join(', ')}`);
      }

      logger.info('Uploading...');
      const [archiveUpload, artifactsUpload, xcodeBuildLogsUpload] = await Promise.allSettled([
        ctx.runtimeApi.uploadArtifacts(
          ArtifactType.APPLICATION_ARCHIVE,
          applicationArchives,
          logger
        ),
        (async () => {
          if (buildArtifacts.length > 0) {
            await ctx.runtimeApi.uploadArtifacts(
              ArtifactType.BUILD_ARTIFACTS,
              buildArtifacts,
              logger
            );
          }
        })(),
        (async () => {
          if (ctx.job.platform !== Platform.IOS) {
            return;
          }
          const xcodeBuildLogsPath = await findXcodeBuildLogsPathAsync(
            stepCtx.global.buildLogsDirectory
          );
          if (xcodeBuildLogsPath) {
            await ctx.runtimeApi.uploadArtifacts(
              ArtifactType.XCODE_BUILD_LOGS,
              [xcodeBuildLogsPath],
              logger
            );
          }
        })(),
      ]);
      if (archiveUpload.status === 'rejected') {
        logger.error('Failed to upload application archive.');
        throw archiveUpload.reason;
      }
      if (artifactsUpload.status === 'rejected') {
        logger.error('Failed to upload build artifacts.');
        throw artifactsUpload.reason;
      }
      if (xcodeBuildLogsUpload.status === 'rejected') {
        logger.error(`Failed to upload Xcode build logs. ${xcodeBuildLogsUpload.reason}`);
      }
      logger.info('Upload finished');
    },
  });
}

function resolveIosArtifactPath(job: Ios.Job): string {
  if (job.applicationArchivePath) {
    return job.applicationArchivePath;
  } else if (job.simulator) {
    return 'ios/build/Build/Products/*simulator/*.app';
  } else {
    return 'ios/build/*.ipa';
  }
}
