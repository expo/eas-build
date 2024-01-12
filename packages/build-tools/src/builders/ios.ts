import plist from '@expo/plist';
import { IOSConfig } from '@expo/config-plugins';
import { BuildMode, BuildPhase, Ios, Workflow } from '@expo/eas-build-job';
import fs from 'fs-extra';
import nullthrows from 'nullthrows';

import { Artifacts, ArtifactType, BuildContext } from '../context';
import { configureExpoUpdatesIfInstalledAsync } from '../utils/expoUpdates';
import { uploadApplicationArchive } from '../utils/artifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { configureXcodeProject } from '../ios/configure';
import CredentialsManager from '../ios/credentials/manager';
import { runFastlaneGym, runFastlaneResign } from '../ios/fastlane';
import { installPods } from '../ios/pod';
import { downloadApplicationArchiveAsync } from '../ios/resign';
import { resolveArtifactPath, resolveBuildConfiguration, resolveScheme } from '../ios/resolve';
import { setupAsync } from '../common/setup';
import { prebuildAsync } from '../common/prebuild';
import { prepareExecutableAsync } from '../utils/prepareBuildExecutable';

import { runBuilderWithHooksAsync } from './common';
import { runCustomBuildAsync } from './custom';

export default async function iosBuilder(ctx: BuildContext<Ios.Job>): Promise<Artifacts> {
  if (ctx.job.mode === BuildMode.BUILD) {
    await prepareExecutableAsync(ctx);
    return await runBuilderWithHooksAsync(ctx, buildAsync);
  } else if (ctx.job.mode === BuildMode.RESIGN) {
    return await resignAsync(ctx);
  } else if (ctx.job.mode === BuildMode.CUSTOM) {
    return await runCustomBuildAsync(ctx);
  } else {
    throw new Error('Not implemented');
  }
}

async function buildAsync(ctx: BuildContext<Ios.Job>): Promise<void> {
  await setupAsync(ctx);
  const hasNativeCode = ctx.job.type === Workflow.GENERIC;

  const credentialsManager = new CredentialsManager(ctx);
  try {
    const credentials = await ctx.runBuildPhase(BuildPhase.PREPARE_CREDENTIALS, async () => {
      return await credentialsManager.prepare();
    });

    await ctx.runBuildPhase(BuildPhase.PREBUILD, async () => {
      if (hasNativeCode) {
        ctx.markBuildPhaseSkipped();
        ctx.logger.info(
          'Skipped running "expo prebuild" because the "ios" directory already exists. Learn more about the build process: https://docs.expo.dev/build-reference/ios-builds/'
        );
        return;
      }
      const extraEnvs: Record<string, string> = credentials?.teamId
        ? { APPLE_TEAM_ID: credentials.teamId }
        : {};
      await prebuildAsync(ctx, {
        logger: ctx.logger,
        workingDir: ctx.getReactNativeProjectDirectory(),
        options: { extraEnvs },
      });
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

  await ctx.runBuildPhase(BuildPhase.UPLOAD_APPLICATION_ARCHIVE, async () => {
    await uploadApplicationArchive(ctx, {
      patternOrPath: resolveArtifactPath(ctx),
      rootDir: ctx.getReactNativeProjectDirectory(),
      logger: ctx.logger,
    });
  });
}

async function readEntitlementsAsync(
  ctx: BuildContext<Ios.Job>,
  { scheme, buildConfiguration }: { scheme: string; buildConfiguration: string }
): Promise<object | null> {
  try {
    const applicationTargetName =
      await IOSConfig.BuildScheme.getApplicationTargetNameForSchemeAsync(
        ctx.getReactNativeProjectDirectory(),
        scheme
      );
    const entitlementsPath = IOSConfig.Entitlements.getEntitlementsPath(
      ctx.getReactNativeProjectDirectory(),
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

async function resignAsync(ctx: BuildContext<Ios.Job>): Promise<Artifacts> {
  const applicationArchivePath = await ctx.runBuildPhase(
    BuildPhase.DOWNLOAD_APPLICATION_ARCHIVE,
    async () => {
      return await downloadApplicationArchiveAsync(ctx);
    }
  );

  const credentialsManager = new CredentialsManager(ctx);
  try {
    const credentials = await ctx.runBuildPhase(BuildPhase.PREPARE_CREDENTIALS, async () => {
      return await credentialsManager.prepare();
    });

    await ctx.runBuildPhase(BuildPhase.RUN_FASTLANE, async () => {
      await runFastlaneResign(ctx, {
        credentials: nullthrows(credentials),
        ipaPath: applicationArchivePath,
      });
    });
  } finally {
    await ctx.runBuildPhase(BuildPhase.CLEAN_UP_CREDENTIALS, async () => {
      await credentialsManager.cleanUp();
    });
  }

  await ctx.runBuildPhase(BuildPhase.UPLOAD_APPLICATION_ARCHIVE, async () => {
    ctx.logger.info(`Application archive: ${applicationArchivePath}`);
    await ctx.uploadArtifacts(
      ArtifactType.APPLICATION_ARCHIVE,
      [applicationArchivePath],
      ctx.logger
    );
  });

  if (!ctx.artifacts.APPLICATION_ARCHIVE) {
    throw new Error('Builder must upload application archive');
  }
  return ctx.artifacts;
}
