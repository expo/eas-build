import { Ios, Job, Platform } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { BuildContext } from '../../../context';
import {
  maybeFindAndUploadBuildArtifacts,
  uploadApplicationArchive,
} from '../../../utils/artifacts';
import { resolveArtifactPath } from '../../../ios/resolve';

export function createFindAndUploadBuildArtifactsBuildFunction<T extends Job>(
  ctx: BuildContext<T>
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'find_and_upload_build_artifacts',
    name: 'Find and upload build artifacts',
    fn: async (stepsCtx) => {
      const applicationArchivePatternOrPath =
        ctx.job.platform === Platform.ANDROID
          ? ctx.job.applicationArchivePath ?? 'android/app/build/outputs/**/*.{apk,aab}'
          : resolveArtifactPath(ctx as BuildContext<Ios.Job>);
      await uploadApplicationArchive(ctx, {
        logger: stepsCtx.logger,
        rootDir: stepsCtx.workingDirectory,
        patternOrPath: applicationArchivePatternOrPath,
      });
      await maybeFindAndUploadBuildArtifacts(ctx, stepsCtx.logger);
    },
  });
}
