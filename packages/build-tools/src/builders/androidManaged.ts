import { AndroidConfig } from '@expo/config-plugins';
import { Android, BuildPhase } from '@expo/eas-build-job';

import { ManagedBuildContext } from '../managed/context';
import { configureExpoUpdatesIfInstalledAsync } from '../utils/expoUpdates';
import { setup } from '../utils/project';
import { findSingleBuildArtifact } from '../utils/buildArtifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { restoreCredentials } from '../android/credentials';
import { runGradleCommand } from '../android/gradle';

export default async function androidManagedBuilder(
  ctx: ManagedBuildContext<Android.ManagedJob>
): Promise<string[]> {
  await setup(ctx);

  await ctx.runBuildPhase(BuildPhase.PREBUILD, async () => {
    await ejectProject(ctx);
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
    await configureExpoUpdatesIfInstalledAsync(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.RUN_GRADLEW, async () => {
    const gradleCommand = resolveGradleCommand(ctx.job.buildType);
    await runGradleCommand(ctx, gradleCommand);
  });

  await ctx.runBuildPhase(BuildPhase.PRE_UPLOAD_ARTIFACTS_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_UPLOAD_ARTIFACTS);
  });

  const buildArtifacts = await ctx.runBuildPhase(BuildPhase.PREPARE_ARTIFACTS, async () => {
    const buildArtifacts = [
      await findSingleBuildArtifact(
        ctx.reactNativeProjectDirectory,
        'android/app/build/outputs/**/*.{apk,aab}',
        ctx.logger
      ),
    ];
    ctx.logger.info(`Build artifacts: ${buildArtifacts.join(', ')}`);
    return buildArtifacts;
  });

  await ctx.runBuildPhase(BuildPhase.SAVE_CACHE, async () => {
    await ctx.cacheManager?.saveCache(ctx);
  });

  return buildArtifacts;
}

function resolveGradleCommand(buildType: Android.ManagedBuildType): string {
  switch (buildType) {
    case Android.ManagedBuildType.APK:
      return ':app:assembleRelease';
    case Android.ManagedBuildType.APP_BUNDLE:
      return ':app:bundleRelease';
    case Android.ManagedBuildType.DEVELOPMENT_CLIENT:
      return ':app:assembleDebug';
    default:
      throw new Error(`unknown artifact type ${buildType}`);
  }
}

async function ejectProject(ctx: ManagedBuildContext<Android.ManagedJob>): Promise<void> {
  await ctx.ejectProvider.runEject(ctx);
  await AndroidConfig.EasBuild.configureEasBuildAsync(ctx.reactNativeProjectDirectory);
}
