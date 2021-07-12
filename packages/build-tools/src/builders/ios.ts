import assert from 'assert';

import { IOSConfig } from '@expo/config-plugins';
import { BuildPhase, Ios, Workflow } from '@expo/eas-build-job';

import { BuildContext } from '../context';
import { configureExpoUpdatesIfInstalledAsync } from '../utils/expoUpdates';
import { setup } from '../utils/project';
import { findBuildArtifacts } from '../utils/buildArtifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { configureXcodeProject } from '../ios/configure';
import CredentialsManager from '../ios/credentials/manager';
import { runFastlaneGym } from '../ios/fastlane';
import { installPods } from '../ios/pod';

export default async function iosBuilder(ctx: BuildContext<Ios.Job>): Promise<string[]> {
  await setup(ctx);
  const hasNativeCode = ctx.job.type === Workflow.GENERIC;

  const credentialsManager = new CredentialsManager(ctx);
  try {
    const credentials = await ctx.runBuildPhase(BuildPhase.PREPARE_CREDENTIALS, async () => {
      return await credentialsManager.prepare();
    });

    if (!hasNativeCode) {
      await ctx.runBuildPhase(BuildPhase.PREBUILD, async () => {
        const extraEnvs: Record<string, string> = credentials?.teamId
          ? { APPLE_TEAM_ID: credentials.teamId }
          : {};
        await ctx.ejectProvider.runEject(ctx, { extraEnvs });
      });
    }

    await ctx.runBuildPhase(BuildPhase.RESTORE_CACHE, async () => {
      await ctx.cacheManager?.restoreCache(ctx);
    });

    await ctx.runBuildPhase(BuildPhase.INSTALL_PODS, async () => {
      await installPods(ctx);
    });

    await ctx.runBuildPhase(BuildPhase.POST_INSTALL_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.POST_INSTALL);
    });

    const buildConfiguration = resolveBuildConfiguration(ctx);
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
      const buildArtifacts = await findBuildArtifacts(
        ctx.reactNativeProjectDirectory,
        resolveArtifactPath(ctx),
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

function resolveScheme(ctx: BuildContext<Ios.Job>): string {
  if (ctx.job.scheme) {
    return ctx.job.scheme;
  }
  const schemes = IOSConfig.BuildScheme.getSchemesFromXcodeproj(ctx.reactNativeProjectDirectory);
  assert(schemes.length === 1, 'Ejected project should have exactly one scheme');
  return schemes[0];
}

function resolveArtifactPath(ctx: BuildContext<Ios.Job>): string {
  if (ctx.job.artifactPath) {
    return ctx.job.artifactPath;
  }
  if (ctx.job.distribution === 'simulator') {
    return 'ios/build/Build/Products/*-iphonesimulator/*.app';
  }
  return 'ios/build/*.ipa';
}

function resolveBuildConfiguration(ctx: BuildContext<Ios.Job>): string {
  if (ctx.job.buildConfiguration) {
    return ctx.job.buildConfiguration;
  }
  if (ctx.job.buildType === Ios.BuildType.DEVELOPMENT_CLIENT) {
    return 'Debug';
  }
  return 'Release';
}
