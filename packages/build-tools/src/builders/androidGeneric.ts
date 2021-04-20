import { Android, BuildPhase } from '@expo/eas-build-job';

import { BuildContext } from '../context';
import { setup } from '../utils/project';
import { findBuildArtifacts } from '../utils/buildArtifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { getReleaseChannel, updateReleaseChannel } from '../android/releaseChannel';
import { restoreCredentials } from '../android/credentials';
import { runGradleCommand, ensureLFLineEndingsInGradlewScript } from '../android/gradle';
import { configureExpoUpdatesIfInstalled } from '../generic/expoUpdates';

export default async function androidGenericBuilder(
  ctx: BuildContext<Android.GenericJob>
): Promise<string[]> {
  await setup(ctx);

  await ctx.runBuildPhase(BuildPhase.FIX_GRADLEW, async () => {
    await ensureLFLineEndingsInGradlewScript(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.RESTORE_CACHE, async () => {
    await ctx.cacheManager?.restoreCache(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.POST_INSTALL_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.POST_INSTALL);
  });

  if (ctx.job.secrets.buildCredentials) {
    await ctx.runBuildPhase(BuildPhase.PREPARE_CREDENTIALS, async () => {
      await restoreCredentials(ctx);
    });
  }

  await ctx.runBuildPhase(BuildPhase.CONFIGURE_EXPO_UPDATES, async () => {
    await configureExpoUpdatesIfInstalled(ctx, { getReleaseChannel, updateReleaseChannel });
  });

  await ctx.runBuildPhase(BuildPhase.RUN_GRADLEW, async () => {
    await runGradleCommand(ctx, ctx.job.gradleCommand);
  });

  await ctx.runBuildPhase(BuildPhase.PRE_UPLOAD_ARTIFACTS_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_UPLOAD_ARTIFACTS);
  });

  const buildArtifacts = await ctx.runBuildPhase(BuildPhase.PREPARE_ARTIFACTS, async () => {
    const buildArtifacts = await findBuildArtifacts(
      ctx.reactNativeProjectDirectory,
      ctx.job.artifactPath,
      ctx.logger
    );
    ctx.logger.info(`Build artifacts: ${buildArtifacts.join(', ')}`);
    return buildArtifacts;
  });

  await ctx.runBuildPhase(BuildPhase.SAVE_CACHE, async () => {
    await ctx.cacheManager?.saveCache(ctx);
  });

  return buildArtifacts;
}
