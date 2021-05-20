import { BuildPhase, Ios, Platform } from '@expo/eas-build-job';

import { BuildContext } from '../context';
import { setup } from '../utils/project';
import { findBuildArtifacts } from '../utils/buildArtifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';
import CredentialsManager from '../ios/credentials/manager';
import { configureXcodeProject } from '../ios/configure';
import { runFastlaneGym } from '../ios/fastlane';
import { installPods } from '../ios/pod';
import { configureExpoUpdatesIfInstalledAsync } from '../utils/expoUpdates';

export default async function iosGenericBuilder(
  ctx: BuildContext<Ios.GenericJob>
): Promise<string[]> {
  await setup(ctx);

  await ctx.runBuildPhase(BuildPhase.RESTORE_CACHE, async () => {
    await ctx.cacheManager?.restoreCache(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.INSTALL_PODS, async () => {
    await installPods(ctx);
  });

  await ctx.runBuildPhase(BuildPhase.POST_INSTALL_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.POST_INSTALL);
  });

  const credentialsManager = new CredentialsManager(ctx);
  try {
    const credentials = await ctx.runBuildPhase(BuildPhase.PREPARE_CREDENTIALS, async () => {
      return await credentialsManager.prepare();
    });
    if (credentials) {
      await ctx.runBuildPhase(BuildPhase.CONFIGURE_XCODE_PROJECT, async () => {
        await configureXcodeProject(ctx, credentials);
      });
    }

    await ctx.runBuildPhase(BuildPhase.CONFIGURE_EXPO_UPDATES, async () => {
      await configureExpoUpdatesIfInstalledAsync(ctx, Platform.IOS);
    });

    await ctx.runBuildPhase(BuildPhase.RUN_FASTLANE, async () => {
      await runFastlaneGym(ctx, {
        credentials,
        scheme: ctx.job.scheme,
        buildConfiguration: ctx.job.buildConfiguration,
      });
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
  } finally {
    await ctx.runBuildPhase(BuildPhase.CLEAN_UP_CREDENTIALS, async () => {
      await credentialsManager.cleanUp();
    });
  }
}
