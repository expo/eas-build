import { AndroidConfig } from '@expo/config-plugins';
import { Android, BuildPhase, Workflow } from '@expo/eas-build-job';

import { BuildContext } from '../context';
import { configureExpoUpdatesIfInstalledAsync } from '../utils/expoUpdates';
import { runGradleCommand, ensureLFLineEndingsInGradlewScript } from '../android/gradle';
import { setup } from '../utils/project';
import { findBuildArtifacts } from '../utils/buildArtifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { restoreCredentials } from '../android/credentials';

export default async function androidBuilder(ctx: BuildContext<Android.Job>): Promise<string[]> {
  await setup(ctx);
  const hasNativeCode = ctx.job.type === Workflow.GENERIC;

  if (hasNativeCode) {
    await ctx.runBuildPhase(BuildPhase.FIX_GRADLEW, async () => {
      await ensureLFLineEndingsInGradlewScript(ctx);
    });
  } else {
    await ctx.runBuildPhase(BuildPhase.PREBUILD, async () => {
      await ejectProject(ctx);
    });
  }

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
    const gradleCommand = resolveGradleCommand(ctx.job);
    await runGradleCommand(ctx, gradleCommand);
  });

  await ctx.runBuildPhase(BuildPhase.PRE_UPLOAD_ARTIFACTS_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_UPLOAD_ARTIFACTS);
  });

  await ctx.runBuildPhase(BuildPhase.SAVE_CACHE, async () => {
    await ctx.cacheManager?.saveCache(ctx);
  });

  return await ctx.runBuildPhase(
    BuildPhase.UPLOAD_ARTIFACTS,
    async () => {
      const buildArtifacts = await findBuildArtifacts(
        ctx.reactNativeProjectDirectory,
        ctx.job.artifactPath ?? 'android/app/build/outputs/**/*.{apk,aab}',
        ctx.logger
      );
      ctx.logger.info(`Build artifacts: ${buildArtifacts.join(', ')}`);
      return buildArtifacts;
    },
    { doNotMarkEnd: true }
  );
}

function resolveGradleCommand(job: Android.Job): string {
  if (job.gradleCommand) {
    return job.gradleCommand;
  } else if (job.useDevelopmentClient) {
    return ':app:assembleDebug';
  } else if (!job.buildType) {
    return ':app:bundleRelease';
  } else if (job.buildType === Android.BuildType.APK) {
    return ':app:assembleRelease';
  } else {
    return ':app:bundleRelease';
  }
}

async function ejectProject(ctx: BuildContext<Android.Job>): Promise<void> {
  await ctx.ejectProvider.runEject(ctx);
  await AndroidConfig.EasBuild.configureEasBuildAsync(ctx.reactNativeProjectDirectory);
}
