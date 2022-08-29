import { BuildPhase, Ios, Job, Platform } from '@expo/eas-build-job';

import { ArtifactType, BuildContext } from '../context';
import { findAndUploadXcodeBuildLogsAsync } from '../ios/xcodeBuildLogs';
import { findArtifacts } from '../utils/artifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';

export async function runBuilderWithHooksAsync<T extends Job>(
  ctx: BuildContext<T>,
  builder: (ctx: BuildContext<T>) => Promise<string>
): Promise<string> {
  let buildSuccess = true;
  try {
    const archiveLocation = await builder(ctx);
    await ctx.runBuildPhase(BuildPhase.ON_BUILD_SUCCESS_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.ON_BUILD_SUCCESS);
    });
    return archiveLocation;
  } catch (err: any) {
    buildSuccess = false;
    await ctx.runBuildPhase(BuildPhase.ON_BUILD_ERROR_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.ON_BUILD_ERROR);
    });
    throw err;
  } finally {
    await ctx.runBuildPhase(BuildPhase.ON_BUILD_COMPLETE_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.ON_BUILD_COMPLETE, {
        extraEnvs: {
          EAS_BUILD_STATUS: buildSuccess ? 'finished' : 'errored',
        },
      });
    });

    if (ctx.job.platform === Platform.IOS) {
      await findAndUploadXcodeBuildLogsAsync(ctx as BuildContext<Ios.Job>);
    }

    await ctx.runBuildPhase(BuildPhase.UPLOAD_BUILD_ARTIFACTS, async () => {
      if (!ctx.job.buildArtifactsPaths || ctx.job.buildArtifactsPaths.length === 0) {
        return;
      }
      try {
        const buildArtifacts = (
          await Promise.all(
            ctx.job.buildArtifactsPaths.map((path) =>
              findArtifacts(ctx.reactNativeProjectDirectory, path, ctx.logger)
            )
          )
        ).flat();
        ctx.logger.info(`Uploading build artifacts: ${buildArtifacts.join(', ')}`);
        await ctx.uploadArtifacts(ArtifactType.BUILD_ARTIFACTS, buildArtifacts, ctx.logger);
      } catch (err: any) {
        ctx.logger.error({ err }, 'Failed to upload build artifacts');
      }
    });
  }
}
