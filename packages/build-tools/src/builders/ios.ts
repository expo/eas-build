import assert from 'assert';

import plist from '@expo/plist';
import { IOSConfig } from '@expo/config-plugins';
import { BuildPhase, Ios, Workflow } from '@expo/eas-build-job';
import fs from 'fs-extra';

import { BuildContext } from '../context';
import { createNpmErrorHandler } from '../utils/handleNpmError';
import { configureExpoUpdatesIfInstalledAsync } from '../utils/expoUpdates';
import { setup } from '../utils/project';
import { findBuildArtifacts } from '../utils/buildArtifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { configureXcodeProject } from '../ios/configure';
import CredentialsManager from '../ios/credentials/manager';
import { runFastlaneGym } from '../ios/fastlane';
import { installPods } from '../ios/pod';
import { prebuildAsync } from '../utils/prebuild';

export default async function iosBuilder(ctx: BuildContext<Ios.Job>): Promise<string> {
  let isBuildSuccess = true;
  try {
    const archiveLocation = await buildAsync(ctx);
    await ctx.runBuildPhase(BuildPhase.ON_BUILD_SUCCESS_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.ON_BUILD_SUCCESS);
    });
    return archiveLocation;
  } catch (err: any) {
    isBuildSuccess = false;
    await ctx.runBuildPhase(BuildPhase.ON_BUILD_ERROR_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.ON_BUILD_ERROR);
    });
    throw err;
  } finally {
    await ctx.runBuildPhase(BuildPhase.ON_BUILD_COMPLETED_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.ON_BUILD_COMPLETED, {
        extraEnvs: {
          EAS_BUILD_STATUS: isBuildSuccess ? 'success' : 'error',
        },
      });
    });
  }
}

async function buildAsync(ctx: BuildContext<Ios.Job>): Promise<string> {
  await setup(ctx);
  const hasNativeCode = ctx.job.type === Workflow.GENERIC;

  const credentialsManager = new CredentialsManager(ctx);
  try {
    const credentials = await ctx.runBuildPhase(BuildPhase.PREPARE_CREDENTIALS, async () => {
      return await credentialsManager.prepare();
    });

    if (!hasNativeCode) {
      await ctx.runBuildPhase(
        BuildPhase.PREBUILD,
        async () => {
          const extraEnvs: Record<string, string> = credentials?.teamId
            ? { APPLE_TEAM_ID: credentials.teamId }
            : {};
          await prebuildAsync(ctx, { extraEnvs });
        },
        { onError: createNpmErrorHandler(ctx) }
      );
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
      const scheme = resolveScheme(ctx);
      const entitlements = await readEntitlementsAsync(ctx, { scheme, buildConfiguration });
      await runFastlaneGym(ctx, {
        credentials,
        scheme,
        buildConfiguration,
        entitlements,
      });
    });
  } finally {
    await ctx.runBuildPhase(BuildPhase.CLEAN_UP_CREDENTIALS, async () => {
      await credentialsManager.cleanUp();
    });
  }

  await ctx.runBuildPhase(BuildPhase.PRE_UPLOAD_ARTIFACTS_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_UPLOAD_ARTIFACTS);
  });

  await ctx.runBuildPhase(BuildPhase.SAVE_CACHE, async () => {
    await ctx.cacheManager?.saveCache(ctx);
  });

  return await ctx.runBuildPhase(BuildPhase.UPLOAD_ARTIFACTS, async () => {
    const buildArtifacts = await findBuildArtifacts(
      ctx.reactNativeProjectDirectory,
      resolveArtifactPath(ctx),
      ctx.logger
    );
    ctx.logger.info(`Build artifacts: ${buildArtifacts.join(', ')}`);
    return await ctx.deliverBuildArtifacts(ctx, buildArtifacts);
  });
}

function resolveScheme(ctx: BuildContext<Ios.Job>): string {
  if (ctx.job.scheme) {
    return ctx.job.scheme;
  }
  const schemes = IOSConfig.BuildScheme.getSchemesFromXcodeproj(ctx.reactNativeProjectDirectory);
  assert(schemes.length === 1, 'Ejected project should have exactly one scheme');
  return schemes[0];
}

async function readEntitlementsAsync(
  ctx: BuildContext<Ios.Job>,
  { scheme, buildConfiguration }: { scheme: string; buildConfiguration: string }
): Promise<object | null> {
  try {
    const applicationTargetName = await IOSConfig.BuildScheme.getApplicationTargetNameForSchemeAsync(
      ctx.reactNativeProjectDirectory,
      scheme
    );
    const entitlementsPath = IOSConfig.Entitlements.getEntitlementsPath(
      ctx.reactNativeProjectDirectory,
      {
        buildConfiguration,
        targetName: applicationTargetName,
      }
    );
    if (!entitlementsPath) {
      return null;
    }
    const entitlementsRaw = await fs.readFile(entitlementsPath, 'utf8');
    return plist.parse(entitlementsRaw);
  } catch (err) {
    ctx.logger.warn({ err }, 'Failed to read entitlements');
    ctx.markBuildPhaseHasWarnings();
    return null;
  }
}

function resolveArtifactPath(ctx: BuildContext<Ios.Job>): string {
  if (ctx.job.artifactPath) {
    return ctx.job.artifactPath;
  } else if (ctx.job.simulator) {
    return 'ios/build/Build/Products/*-iphonesimulator/*.app';
  } else {
    return 'ios/build/*.ipa';
  }
}

function resolveBuildConfiguration(ctx: BuildContext<Ios.Job>): string {
  if (ctx.job.buildConfiguration) {
    return ctx.job.buildConfiguration;
  } else if (ctx.job.developmentClient) {
    return 'Debug';
  } else {
    return 'Release';
  }
}
