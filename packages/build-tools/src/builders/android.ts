import { createHash } from 'crypto';
import path from 'path';

import { Android, BuildMode, BuildPhase, Workflow } from '@expo/eas-build-job';
import * as PackageManagerUtils from '@expo/package-manager';
import fs from 'fs-extra';
import nullthrows from 'nullthrows';
import { asyncResult } from '@expo/results';
import { spawnAsync } from '@expo/steps';

import { Artifacts, BuildContext, SkipNativeBuildError } from '../context';
import {
  configureExpoUpdatesIfInstalledAsync,
  resolveRuntimeVersionForExpoUpdatesIfConfiguredAsync,
} from '../utils/expoUpdates';
import {
  runGradleCommand,
  ensureLFLineEndingsInGradlewScript,
  resolveGradleCommand,
} from '../android/gradle';
import { uploadApplicationArchive } from '../utils/artifacts';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { restoreCredentials } from '../android/credentials';
import { configureBuildGradle } from '../android/gradleConfig';
import { setupAsync } from '../common/setup';
import { prebuildAsync } from '../common/prebuild';
import { prepareExecutableAsync } from '../utils/prepareBuildExecutable';
import { eagerBundleAsync, shouldUseEagerBundle } from '../common/eagerBundle';
import { decompressCacheAsync, downloadCacheAsync } from '../steps/functions/restoreCache';
import { compressCacheAsync, uploadCacheAsync } from '../steps/functions/saveCache';
import { findPackagerRootDir } from '../utils/packageManager';

import { runBuilderWithHooksAsync } from './common';
import { runCustomBuildAsync } from './custom';

const CACHE_KEY_PREFIX = 'android-ccache-';

export default async function androidBuilder(ctx: BuildContext<Android.Job>): Promise<Artifacts> {
  if (ctx.job.mode === BuildMode.BUILD) {
    await prepareExecutableAsync(ctx);
    return await runBuilderWithHooksAsync(ctx, buildAsync);
  } else if (ctx.job.mode === BuildMode.RESIGN) {
    throw new Error('Not implemented');
  } else if (ctx.job.mode === BuildMode.CUSTOM || ctx.job.mode === BuildMode.REPACK) {
    return await runCustomBuildAsync(ctx);
  } else {
    throw new Error('Not implemented');
  }
}

async function buildAsync(ctx: BuildContext<Android.Job>): Promise<void> {
  await setupAsync(ctx);
  const buildStart = Date.now();
  const workingDirectory = ctx.getReactNativeProjectDirectory();
  const cachePaths = [path.join(ctx.env.HOME, '.cache/ccache')];
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
    await prebuildAsync(ctx, {
      logger: ctx.logger,
      workingDir: ctx.getReactNativeProjectDirectory(),
    });
  });

  await ctx.runBuildPhase(BuildPhase.RESTORE_CACHE, async () => {
    await ctx.cacheManager?.restoreCache(ctx);
    if (
      ctx.env.EAS_RESTORE_CACHE === '1' ||
      (ctx.env.EAS_USE_CACHE === '1' && ctx.env.EAS_RESTORE_CACHE !== '0')
    ) {
      try {
        const cacheKey = await generateCacheKeyAsync(workingDirectory);
        const jobId = nullthrows(ctx.env.EAS_BUILD_ID, 'EAS_BUILD_ID is not set');

        const robotAccessToken = nullthrows(
          ctx.job.secrets?.robotAccessToken,
          'Robot access token is required for cache operations'
        );
        const expoApiServerURL = nullthrows(
          ctx.env.__API_SERVER_URL,
          '__API_SERVER_URL is not set'
        );

        const { archivePath } = await downloadCacheAsync({
          logger: ctx.logger,
          jobId,
          expoApiServerURL,
          robotAccessToken,
          paths: cachePaths,
          key: cacheKey,
          keyPrefixes: [CACHE_KEY_PREFIX],
          platform: ctx.job.platform,
        });

        await decompressCacheAsync({
          archivePath,
          workingDirectory,
          verbose: ctx.env.EXPO_DEBUG === '1',
          logger: ctx.logger,
        });

        ctx.logger.info('Cache restored successfully');
        await asyncResult(
          spawnAsync('ccache', ['--zero-stats'], {
            env: ctx.env,
            logger: ctx.logger,
            stdio: 'pipe',
          })
        );
      } catch (err: any) {
        if (err.response.status === 404) {
          ctx.logger.info('No cache found for this key. Create a cache with function save_cache');
        } else {
          ctx.logger.warn({ err }, 'Failed to restore cache');
        }
      }
    }
  });

  await ctx.runBuildPhase(BuildPhase.POST_INSTALL_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.POST_INSTALL);
  });

  const resolvedExpoUpdatesRuntimeVersion = await ctx.runBuildPhase(
    BuildPhase.CALCULATE_EXPO_UPDATES_RUNTIME_VERSION,
    async () => {
      return await resolveRuntimeVersionForExpoUpdatesIfConfiguredAsync({
        cwd: ctx.getReactNativeProjectDirectory(),
        logger: ctx.logger,
        appConfig: ctx.appConfig,
        platform: ctx.job.platform,
        workflow: ctx.job.type,
        env: ctx.env,
      });
    }
  );

  if (
    nullthrows(ctx.job.secrets, 'Secrets must be defined for non-custom builds').buildCredentials
  ) {
    await ctx.runBuildPhase(BuildPhase.PREPARE_CREDENTIALS, async () => {
      await restoreCredentials(ctx);
      await configureBuildGradle(ctx);
    });
  }
  await ctx.runBuildPhase(BuildPhase.CONFIGURE_EXPO_UPDATES, async () => {
    await configureExpoUpdatesIfInstalledAsync(ctx, {
      resolvedRuntimeVersion: resolvedExpoUpdatesRuntimeVersion?.runtimeVersion ?? null,
      resolvedFingerprintSources: resolvedExpoUpdatesRuntimeVersion?.fingerprintSources ?? null,
    });
  });

  if (ctx.skipNativeBuild) {
    throw new SkipNativeBuildError('Skipping Gradle build');
  }

  if (!ctx.env.EAS_BUILD_DISABLE_BUNDLE_JAVASCRIPT_STEP && shouldUseEagerBundle(ctx.metadata)) {
    await ctx.runBuildPhase(BuildPhase.EAGER_BUNDLE, async () => {
      await eagerBundleAsync({
        platform: ctx.job.platform,
        workingDir: ctx.getReactNativeProjectDirectory(),
        logger: ctx.logger,
        env: {
          ...ctx.env,
          ...(resolvedExpoUpdatesRuntimeVersion?.runtimeVersion
            ? {
                EXPO_UPDATES_FINGERPRINT_OVERRIDE:
                  resolvedExpoUpdatesRuntimeVersion?.runtimeVersion,
                EXPO_UPDATES_WORKFLOW_OVERRIDE: ctx.job.type,
              }
            : null),
        },
        packageManager: ctx.packageManager,
      });
    });
  }

  await ctx.runBuildPhase(BuildPhase.RUN_GRADLEW, async () => {
    const gradleCommand = resolveGradleCommand(ctx.job);
    await runGradleCommand(ctx, {
      logger: ctx.logger,
      gradleCommand,
      androidDir: path.join(ctx.getReactNativeProjectDirectory(), 'android'),
      ...(resolvedExpoUpdatesRuntimeVersion?.runtimeVersion
        ? {
            extraEnv: {
              EXPO_UPDATES_FINGERPRINT_OVERRIDE: resolvedExpoUpdatesRuntimeVersion.runtimeVersion,
              EXPO_UPDATES_WORKFLOW_OVERRIDE: ctx.job.type,
            },
          }
        : null),
    });
  });

  await ctx.runBuildPhase(BuildPhase.PRE_UPLOAD_ARTIFACTS_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_UPLOAD_ARTIFACTS);
  });

  await ctx.runBuildPhase(BuildPhase.UPLOAD_APPLICATION_ARCHIVE, async () => {
    await uploadApplicationArchive(ctx, {
      patternOrPath: ctx.job.applicationArchivePath ?? 'android/app/build/outputs/**/*.{apk,aab}',
      rootDir: ctx.getReactNativeProjectDirectory(),
      logger: ctx.logger,
    });
  });

  await ctx.runBuildPhase(BuildPhase.SAVE_CACHE, async () => {
    await ctx.cacheManager?.saveCache(ctx);
    if (
      ctx.env.EAS_SAVE_CACHE === '1' ||
      (ctx.env.EAS_USE_CACHE === '1' && ctx.env.EAS_SAVE_CACHE !== '0')
    ) {
      try {
        const cacheKey = await generateCacheKeyAsync(workingDirectory);
        const jobId = nullthrows(ctx.env.EAS_BUILD_ID, 'EAS_BUILD_ID is not set');

        const robotAccessToken = nullthrows(
          ctx.job.secrets?.robotAccessToken,
          'Robot access token is required for cache operations'
        );
        const expoApiServerURL = nullthrows(
          ctx.env.__API_SERVER_URL,
          '__API_SERVER_URL is not set'
        );

        // cache size can blow up over time over many builds, so evict stale files and only upload what was used within this builds time window
        const evictWindow = Math.floor((Date.now() - buildStart) / 1000);
        ctx.logger.info('Pruning cache...');
        await asyncResult(
          spawnAsync('ccache', ['--evict-older-than', evictWindow + 's'], {
            env: ctx.env,
            logger: ctx.logger,
            stdio: 'pipe',
          })
        );

        ctx.logger.info('Cache stats:');
        await asyncResult(
          spawnAsync('ccache', ['--show-stats', '-v'], {
            env: ctx.env,
            logger: ctx.logger,
            stdio: 'pipe',
          })
        );

        ctx.logger.info('Preparing cache archive...');

        const { archivePath } = await compressCacheAsync({
          paths: cachePaths,
          workingDirectory,
          verbose: ctx.env.EXPO_DEBUG === '1',
          logger: ctx.logger,
        });

        const { size } = await fs.stat(archivePath);

        await uploadCacheAsync({
          logger: ctx.logger,
          jobId,
          expoApiServerURL,
          robotAccessToken,
          archivePath,
          key: cacheKey,
          paths: cachePaths,
          size,
          platform: ctx.job.platform,
        });
      } catch (err) {
        ctx.logger.error({ err }, 'Failed to save cache');
      }
    }
  });
}

async function generateCacheKeyAsync(workingDirectory: string): Promise<string> {
  // This will resolve which package manager and use the relevant lock file
  // The lock file hash is the key and ensures cache is fresh
  const packagerRunDir = findPackagerRootDir(workingDirectory);
  const manager = PackageManagerUtils.createForProject(packagerRunDir);
  const lockPath = path.join(packagerRunDir, manager.lockFile);

  try {
    const key = await hashFiles([lockPath]);
    return `${CACHE_KEY_PREFIX}${key}`;
  } catch (err: any) {
    throw new Error(`Failed to read package files for cache key generation: ${err.message}`);
  }
}

async function hashFiles(filePaths: string[]): Promise<string> {
  const hashes: string[] = [];

  for (const filePath of filePaths) {
    try {
      if (await fs.pathExists(filePath)) {
        const fileContent = await fs.readFile(filePath);
        const fileHash = createHash('sha256').update(fileContent).digest('hex');
        hashes.push(fileHash);
      }
    } catch (err: any) {
      throw new Error(`Failed to hash file ${filePath}: ${err.message}`);
    }
  }

  const combinedHashes = hashes.join('');
  return createHash('sha256').update(combinedHashes).digest('hex');
}
