import { Ios, Job, Platform } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { ArtifactType, BuildContext } from '../../../context';
import { findArtifacts } from '../../../utils/artifacts';
import { resolveArtifactPath } from '../../../ios/resolve';

export function createFindAndUploadApplicationArchiveBuildFunction<T extends Job>(
  ctx: BuildContext<T>
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'find_and_upload_application_archive',
    name: 'Find and upload application archive',
    fn: async (stepsCtx) => {
      const patternOrPath =
        ctx.job.platform === Platform.ANDROID
          ? ctx.job.applicationArchivePath ?? 'android/app/build/outputs/**/*.{apk,aab}'
          : resolveArtifactPath(ctx as BuildContext<Ios.Job>);
      const applicationArchives = await findArtifacts(
        stepsCtx.workingDirectory,
        patternOrPath,
        stepsCtx.logger
      );
      ctx.logger.info(`Application archives: ${applicationArchives.join(', ')}`);
      await ctx.uploadArtifacts(
        ArtifactType.APPLICATION_ARCHIVE,
        applicationArchives,
        stepsCtx.logger
      );
    },
  });
}
