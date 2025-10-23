import { BinaryLike, createHash } from 'crypto';
import path from 'path';

import plist from '@expo/plist';
import { IOSConfig } from '@expo/config-plugins';
import { ManagedArtifactType, BuildMode, BuildPhase, Ios, Workflow } from '@expo/eas-build-job';
import fs from 'fs-extra';
import nullthrows from 'nullthrows';
import * as PackageManagerUtils from '@expo/package-manager';
import { spawnAsync } from '@expo/steps';
import { asyncResult } from '@expo/results';

import { Artifacts, BuildContext } from '../context';
import {
  resolveRuntimeVersionForExpoUpdatesIfConfiguredAsync,
  configureExpoUpdatesIfInstalledAsync,
} from '../utils/expoUpdates';
import { TurtleFetchError } from '../utils/turtleFetch';
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
import { getParentAndDescendantProcessPidsAsync } from '../utils/processes';
import { eagerBundleAsync, shouldUseEagerBundle } from '../common/eagerBundle';
import { uploadCacheAsync, compressCacheAsync } from '../steps/functions/saveCache';
import { downloadCacheAsync, decompressCacheAsync } from '../steps/functions/restoreCache';
import { findPackagerRootDir } from '../utils/packageManager';

import { runBuilderWithHooksAsync } from './common';
import { runCustomBuildAsync } from './custom';

const INSTALL_PODS_WARN_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const INSTALL_PODS_KILL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_KEY_PREFIX = 'ios-ccache-';

class InstallPodsTimeoutError extends Error {}

export default async function iosBuilder(ctx: BuildContext<Ios.Job>): Promise<Artifacts> {
  if (ctx.job.mode === BuildMode.BUILD) {
    await prepareExecutableAsync(ctx);
    return await runBuilderWithHooksAsync(ctx, buildAsync);
  } else if (ctx.job.mode === BuildMode.RESIGN) {
    return await resignAsync(ctx);
  } else if (ctx.job.mode === BuildMode.CUSTOM || ctx.job.mode === BuildMode.REPACK) {
    return await runCustomBuildAsync(ctx);
  } else {
    throw new Error('Not implemented');
  }
}

async function buildAsync(ctx: BuildContext<Ios.Job>): Promise<void> {
  await setupAsync(ctx);
  const hasNativeCode = ctx.job.type === Workflow.GENERIC;
  const buildStart = Date.now();
  const credentialsManager = new CredentialsManager(ctx);
  const workingDirectory = ctx.getReactNativeProjectDirectory();
  const cachePaths = [path.join(ctx.env.HOME, 'Library/Caches/ccache')];
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
      if (ctx.shouldRestoreCache) {
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
        } catch (err: unknown) {
          if (err instanceof TurtleFetchError && err.response.status === 404) {
            ctx.logger.info('No cache found for this key. Create a cache with function save_cache');
          } else {
            ctx.logger.warn({ err }, 'Failed to restore cache');
          }
        }
      }
    });

    await ctx.runBuildPhase(BuildPhase.INSTALL_PODS, async () => {
      await runInstallPodsAsync(ctx);
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

    const buildConfiguration = resolveBuildConfiguration(ctx);
    if (credentials) {
      await ctx.runBuildPhase(BuildPhase.CONFIGURE_XCODE_PROJECT, async () => {
        await configureXcodeProject(ctx, { credentials, buildConfiguration });
      });
    }

    await ctx.runBuildPhase(BuildPhase.CONFIGURE_EXPO_UPDATES, async () => {
      await configureExpoUpdatesIfInstalledAsync(ctx, {
        resolvedRuntimeVersion: resolvedExpoUpdatesRuntimeVersion?.runtimeVersion ?? null,
        resolvedFingerprintSources: resolvedExpoUpdatesRuntimeVersion?.fingerprintSources ?? null,
      });
    });

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

    await ctx.runBuildPhase(BuildPhase.RUN_FASTLANE, async () => {
      const scheme = resolveScheme(ctx);
      const entitlements = await readEntitlementsAsync(ctx, { scheme, buildConfiguration });
      await runFastlaneGym(ctx, {
        credentials,
        scheme,
        buildConfiguration,
        entitlements,
        ...(resolvedExpoUpdatesRuntimeVersion?.runtimeVersion
          ? {
              extraEnv: {
                EXPO_UPDATES_FINGERPRINT_OVERRIDE:
                  resolvedExpoUpdatesRuntimeVersion?.runtimeVersion,
                EXPO_UPDATES_WORKFLOW_OVERRIDE: ctx.job.type,
              },
            }
          : null),
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

  await ctx.runBuildPhase(BuildPhase.UPLOAD_APPLICATION_ARCHIVE, async () => {
    await uploadApplicationArchive(ctx, {
      patternOrPath: resolveArtifactPath(ctx),
      rootDir: ctx.getReactNativeProjectDirectory(),
      logger: ctx.logger,
    });
  });

  await ctx.runBuildPhase(BuildPhase.SAVE_CACHE, async () => {
    await ctx.cacheManager?.saveCache(ctx);
    if (ctx.shouldSaveCache) {
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
    await ctx.uploadArtifact({
      artifact: {
        type: ManagedArtifactType.APPLICATION_ARCHIVE,
        paths: [applicationArchivePath],
      },
      logger: ctx.logger,
    });
  });

  return ctx.artifacts;
}

async function runInstallPodsAsync(ctx: BuildContext<Ios.Job>): Promise<void> {
  let warnTimeout: NodeJS.Timeout | undefined;
  let killTimeout: NodeJS.Timeout | undefined;
  let timedOutToKill: boolean = false;
  try {
    const installPodsSpawnPromise = (
      await installPods(ctx, {
        infoCallbackFn: () => {
          warnTimeout?.refresh();
          killTimeout?.refresh();
        },
      })
    ).spawnPromise;
    warnTimeout = setTimeout(() => {
      ctx.logger.warn(
        '"Install pods" phase takes longer then expected and it did not produce any logs in the past 15 minutes'
      );
    }, INSTALL_PODS_WARN_TIMEOUT_MS);

    killTimeout = setTimeout(async () => {
      timedOutToKill = true;
      ctx.logger.error(
        '"Install pods" phase takes a very long time and it did not produce any logs in the past 30 minutes. Most likely an unexpected error happened which caused the process to hang and it will be terminated'
      );
      const ppid = nullthrows(installPodsSpawnPromise.child.pid);
      const pids = await getParentAndDescendantProcessPidsAsync(ppid);
      pids.forEach((pid) => {
        process.kill(pid);
      });
      ctx.reportError?.('"Install pods" phase takes a very long time', undefined, {
        extras: { buildId: ctx.env.EAS_BUILD_ID },
      });
    }, INSTALL_PODS_KILL_TIMEOUT_MS);

    await installPodsSpawnPromise;
  } catch (err: any) {
    if (timedOutToKill) {
      throw new InstallPodsTimeoutError('"Install pods" phase was inactive for over 30 minutes');
    }
    throw err;
  } finally {
    if (warnTimeout) {
      clearTimeout(warnTimeout);
    }
    if (killTimeout) {
      clearTimeout(killTimeout);
    }
  }
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
        const fileHash = createHash('sha256')
          .update(fileContent as BinaryLike)
          .digest('hex');
        hashes.push(fileHash);
      }
    } catch (err: any) {
      throw new Error(`Failed to hash file ${filePath}: ${err.message}`);
    }
  }

  const combinedHashes = hashes.join('');
  return createHash('sha256').update(combinedHashes).digest('hex');
}
