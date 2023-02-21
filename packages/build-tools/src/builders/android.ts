import { Android, BuildMode, BuildPhase, Workflow } from '@expo/eas-build-job';
import nullthrows from 'nullthrows';

import { Artifacts, ArtifactType, BuildContext, SkipNativeBuildError } from '../context';
import { configureExpoUpdatesIfInstalledAsync } from '../utils/expoUpdates';
import { runGradleCommand, ensureLFLineEndingsInGradlewScript } from '../android/gradle';
import { findArtifacts } from '../utils/artifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { restoreCredentials } from '../android/credentials';
import { configureBuildGradle } from '../android/gradleConfig';
import { setupAsync } from '../common/setup';
import { prebuildAsync } from '../common/prebuild';

import { runBuilderWithHooksAsync } from './common';
import { runCustomBuildAsync } from './custom';

export default async function androidBuilder(ctx: BuildContext<Android.Job>): Promise<Artifacts> {
  if (ctx.job.mode === BuildMode.BUILD) {
    return await runBuilderWithHooksAsync(ctx, buildAsync);
  } else if (ctx.job.mode === BuildMode.RESIGN) {
    throw new Error('Not implemented');
  } else if (ctx.job.mode === BuildMode.CUSTOM) {
    return await runCustomBuildAsync(ctx);
  } else {
    throw new Error('Not implemented');
  }
}

async function buildAsync(ctx: BuildContext<Android.Job>): Promise<void> {
  await setupAsync(ctx);
  const hasNativeCode = ctx.job.type === Workflow.GENERIC;

  if (hasNativeCode) {
    await ctx.runBuildPhase(BuildPhase.FIX_GRADLEW, async () => {
      await ensureLFLineEndingsInGradlewScript(ctx);
    });
  }

  await ctx.runBuildPhase(BuildPhase.PREBUILD, async () => {
    if (hasNativeCode) {
      ctx.markBuildPhaseSkipped();
      ctx.logger.info(
        'Skipped running "expo prebuild" because the "android" directory already exists. Learn more about the build process: https://docs.expo.dev/build-reference/android-builds/'
      );
      return;
    }
    await prebuildAsync(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.RESTORE_CACHE, async () => {
    await ctx.cacheManager?.restoreCache(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.POST_INSTALL_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.POST_INSTALL);
  });

  if (
    nullthrows(ctx.job.secrets, 'Secrets must be defined for non-custom builds').buildCredentials
  ) {
    await ctx.runBuildPhase(BuildPhase.PREPARE_CREDENTIALS, async () => {
      await restoreCredentials(ctx);
      await configureBuildGradle(ctx);
    });
  }
  await ctx.runBuildPhase(BuildPhase.CONFIGURE_EXPO_UPDATES, async () => {
    await configureExpoUpdatesIfInstalledAsync(ctx);
  });

  if (ctx.skipNativeBuild) {
    throw new SkipNativeBuildError('Skipping Gradle build');
  }
  await ctx.runBuildPhase(BuildPhase.RUN_GRADLEW, async () => {
    const gradleCommand = resolveGradleCommand(ctx.job);
    await runGradleCommand(ctx, gradleCommand);
  });

  await ctx.runBuildPhase(BuildPhase.PRE_UPLOAD_ARTIFACTS_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_UPLOAD_ARTIFACTS);
  });

  await ctx.runBuildPhase(BuildPhase.SAVE_CACHE, async () => {
    await ctx.cacheManager?.saveCache(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.UPLOAD_APPLICATION_ARCHIVE, async () => {
    const applicationArchives = await findArtifacts(
      ctx.reactNativeProjectDirectory,
      ctx.job.applicationArchivePath ?? 'android/app/build/outputs/**/*.{apk,aab}',
      ctx.logger
    );
    ctx.logger.info(`Application archives: ${applicationArchives.join(', ')}`);
    await ctx.uploadArtifacts(ArtifactType.APPLICATION_ARCHIVE, applicationArchives, ctx.logger);
  });
}

function resolveGradleCommand(job: Android.Job): string {
  if (job.gradleCommand) {
    return job.gradleCommand;
  } else if (job.developmentClient) {
    return ':app:assembleDebug';
  } else if (!job.buildType) {
    return ':app:bundleRelease';
  } else if (job.buildType === Android.BuildType.APK) {
    return ':app:assembleRelease';
  } else {
    return ':app:bundleRelease';
  }
}
