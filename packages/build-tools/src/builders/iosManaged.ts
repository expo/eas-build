import assert from 'assert';

import { IOSConfig } from '@expo/config-plugins';
import { BuildPhase, Ios } from '@expo/eas-build-job';

import { ManagedBuildContext } from '../managed/context';
import { configureExpoUpdatesIfInstalledAsync } from '../utils/expoUpdates';
import { setup } from '../utils/project';
import { findSingleBuildArtifact } from '../utils/buildArtifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { configureXcodeProject } from '../ios/configure';
import CredentialsManager from '../ios/credentials/manager';
import { runFastlaneGym } from '../ios/fastlane';
import { installPods } from '../ios/pod';

export default async function iosManagedBuilder(
  ctx: ManagedBuildContext<Ios.ManagedJob>
): Promise<string[]> {
  await setup(ctx);

  await ctx.runBuildPhase(BuildPhase.PREBUILD, async () => {
    await ejectProject(ctx);
  });

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
    const buildConfiguration =
      ctx.job.buildType === Ios.ManagedBuildType.DEVELOPMENT_CLIENT ? 'Debug' : 'Release';
    if (credentials) {
      await ctx.runBuildPhase(BuildPhase.CONFIGURE_XCODE_PROJECT, async () => {
        await configureXcodeProject(ctx, { credentials, buildConfiguration });
      });
    }

    await ctx.runBuildPhase(BuildPhase.CONFIGURE_EXPO_UPDATES, async () => {
      await configureExpoUpdatesIfInstalledAsync(ctx);
    });

    await ctx.runBuildPhase(BuildPhase.RUN_FASTLANE, async () => {
      await runFastlaneGym(ctx, {
        credentials,
        scheme: resolveScheme(ctx),
        buildConfiguration,
      });
    });

    await ctx.runBuildPhase(BuildPhase.PRE_UPLOAD_ARTIFACTS_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.PRE_UPLOAD_ARTIFACTS);
    });

    const buildArtifacts = await ctx.runBuildPhase(BuildPhase.PREPARE_ARTIFACTS, async () => {
      const buildArtifacts = [
        await findSingleBuildArtifact(
          ctx.reactNativeProjectDirectory,
          ctx.job.distribution === 'simulator'
            ? 'ios/build/Build/Products/*-iphonesimulator/*.app'
            : 'ios/build/*.ipa',
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
  } finally {
    await ctx.runBuildPhase(BuildPhase.CLEAN_UP_CREDENTIALS, async () => {
      await credentialsManager.cleanUp();
    });
  }
}

function resolveScheme(ctx: ManagedBuildContext<Ios.ManagedJob>): string {
  const schemes = IOSConfig.BuildScheme.getSchemesFromXcodeproj(ctx.reactNativeProjectDirectory);
  assert(schemes.length === 1, 'Ejected project should have exactly one scheme');
  return schemes[0];
}

async function ejectProject(ctx: ManagedBuildContext<Ios.ManagedJob>): Promise<void> {
  await ctx.ejectProvider.runEject(ctx);
}
