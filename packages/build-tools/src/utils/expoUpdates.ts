import assert from 'assert';

import { Platform, Job, BuildJob, Workflow, FingerprintSourceType } from '@expo/eas-build-job';
import semver from 'semver';
import { ExpoConfig } from '@expo/config';
import { bunyan } from '@expo/logger';
import { BuildStepEnv } from '@expo/steps';
import fetch from 'node-fetch';
import fs from 'fs-extra';

import {
  androidSetRuntimeVersionNativelyAsync,
  androidSetChannelNativelyAsync,
  androidGetNativelyDefinedRuntimeVersionAsync,
  androidGetNativelyDefinedChannelAsync,
} from '../android/expoUpdates';
import {
  iosSetRuntimeVersionNativelyAsync,
  iosSetChannelNativelyAsync,
  iosGetNativelyDefinedRuntimeVersionAsync,
  iosGetNativelyDefinedChannelAsync,
} from '../ios/expoUpdates';
import { BuildContext } from '../context';

import getExpoUpdatesPackageVersionIfInstalledAsync from './getExpoUpdatesPackageVersionIfInstalledAsync';
import { resolveRuntimeVersionAsync } from './resolveRuntimeVersionAsync';
import {
  Fingerprint,
  FingerprintSource,
  diffFingerprints,
  stringifyFingerprintDiff,
} from './fingerprint';

export async function setRuntimeVersionNativelyAsync(
  ctx: BuildContext<Job>,
  runtimeVersion: string
): Promise<void> {
  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      await androidSetRuntimeVersionNativelyAsync(ctx, runtimeVersion);
      return;
    }
    case Platform.IOS: {
      await iosSetRuntimeVersionNativelyAsync(ctx, runtimeVersion);
      return;
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

/**
 * Used for when Expo Updates is pointed at an EAS server.
 */
export async function setChannelNativelyAsync(ctx: BuildContext<BuildJob>): Promise<void> {
  assert(ctx.job.updates?.channel, 'updates.channel must be defined');
  const newUpdateRequestHeaders: Record<string, string> = {
    'expo-channel-name': ctx.job.updates.channel,
  };

  const configFile = ctx.job.platform === Platform.ANDROID ? 'AndroidManifest.xml' : 'Expo.plist';
  ctx.logger.info(
    `Setting the update request headers in '${configFile}' to '${JSON.stringify(
      newUpdateRequestHeaders
    )}'`
  );

  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      await androidSetChannelNativelyAsync(ctx);
      return;
    }
    case Platform.IOS: {
      await iosSetChannelNativelyAsync(ctx);
      return;
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

export async function configureEASExpoUpdatesAsync(ctx: BuildContext<BuildJob>): Promise<void> {
  await setChannelNativelyAsync(ctx);
}

type ResolvedRuntime = {
  resolvedRuntimeVersion: string | null;
  resolvedFingerprintSources?: FingerprintSource[] | null;
};

export async function configureExpoUpdatesIfInstalledAsync(
  ctx: BuildContext<BuildJob>,
  resolvedRuntime: ResolvedRuntime
): Promise<void> {
  const expoUpdatesPackageVersion = await getExpoUpdatesPackageVersionIfInstalledAsync(
    ctx.getReactNativeProjectDirectory(),
    ctx.logger
  );
  if (expoUpdatesPackageVersion === null) {
    return;
  }

  const appConfigRuntimeVersion =
    ctx.job.version?.runtimeVersion ?? resolvedRuntime.resolvedRuntimeVersion;

  if (ctx.metadata?.runtimeVersion && ctx.metadata.runtimeVersion !== appConfigRuntimeVersion) {
    ctx.markBuildPhaseHasWarnings();
    ctx.logger.warn('Runtime version mismatch');
    ctx.logger.warn(`Runtime version on your local machine: ${ctx.metadata.runtimeVersion}`);
    ctx.logger.warn(`Runtime version calculated on EAS: ${appConfigRuntimeVersion}`);

    await logDiffFingerprints({ resolvedRuntime, ctx });
  }

  if (isEASUpdateConfigured(ctx)) {
    if (ctx.job.updates?.channel !== undefined) {
      await configureEASExpoUpdatesAsync(ctx);
    } else {
      const channel = await getChannelAsync(ctx);
      const isDevelopmentClient = ctx.job.developmentClient ?? false;

      if (channel !== null) {
        const configFile =
          ctx.job.platform === Platform.ANDROID ? 'AndroidManifest.xml' : 'Expo.plist';
        ctx.logger.info(`The channel name for EAS Update in ${configFile} is set to "${channel}"`);
      } else if (isDevelopmentClient) {
        // NO-OP: Development clients don't need to have a channel set
      } else {
        const easUpdateUrl = ctx.appConfig.updates?.url ?? null;
        const jobProfile = ctx.job.buildProfile ?? null;
        ctx.logger.warn(
          `This build has an invalid EAS Update configuration: update.url is set to "${easUpdateUrl}" in app config, but a channel is not specified${
            jobProfile ? '' : ` for the current build profile "${jobProfile}" in eas.json`
          }.`
        );
        ctx.logger.warn(`- No channel will be set and EAS Update will be disabled for the build.`);
        ctx.logger.warn(
          `- Run \`eas update:configure\` to set your channel in eas.json. For more details, see https://docs.expo.dev/eas-update/getting-started/#configure-your-project`
        );

        ctx.markBuildPhaseHasWarnings();
      }
    }
  }

  if (ctx.job.version?.runtimeVersion) {
    ctx.logger.info('Updating runtimeVersion in Expo.plist');
    await setRuntimeVersionNativelyAsync(ctx, ctx.job.version.runtimeVersion);
  }
}

export async function resolveRuntimeVersionForExpoUpdatesIfConfiguredAsync({
  cwd,
  appConfig,
  platform,
  workflow,
  logger,
  env,
}: {
  cwd: string;
  appConfig: ExpoConfig;
  platform: Platform;
  workflow: Workflow;
  logger: bunyan;
  env: BuildStepEnv;
}): Promise<{
  runtimeVersion: string | null;
  fingerprintSources: FingerprintSource[] | null;
} | null> {
  const expoUpdatesPackageVersion = await getExpoUpdatesPackageVersionIfInstalledAsync(cwd, logger);
  if (expoUpdatesPackageVersion === null) {
    return null;
  }

  const resolvedRuntimeVersion = await resolveRuntimeVersionAsync({
    projectDir: cwd,
    exp: appConfig,
    platform,
    workflow,
    logger,
    expoUpdatesPackageVersion,
    env,
  });

  logger.info(`Resolved runtime version: ${resolvedRuntimeVersion?.runtimeVersion}`);
  return resolvedRuntimeVersion;
}

export async function getChannelAsync(ctx: BuildContext<Job>): Promise<string | null> {
  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      return await androidGetNativelyDefinedChannelAsync(ctx);
    }
    case Platform.IOS: {
      return await iosGetNativelyDefinedChannelAsync(ctx);
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

export async function getRuntimeVersionAsync(ctx: BuildContext<Job>): Promise<string | null> {
  switch (ctx.job.platform) {
    case Platform.ANDROID: {
      return await androidGetNativelyDefinedRuntimeVersionAsync(ctx);
    }
    case Platform.IOS: {
      return await iosGetNativelyDefinedRuntimeVersionAsync(ctx);
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

export function isEASUpdateConfigured(ctx: BuildContext<Job>): boolean {
  const rawUrl = ctx.appConfig.updates?.url;
  if (!rawUrl) {
    return false;
  }
  try {
    const url = new URL(rawUrl);
    return ['u.expo.dev', 'staging-u.expo.dev'].includes(url.hostname);
  } catch (err) {
    ctx.logger.error({ err }, `Cannot parse expo.updates.url = ${rawUrl} as URL`);
    ctx.logger.error(`Assuming EAS Update is not configured`);
    return false;
  }
}

export function isModernExpoUpdatesCLIWithRuntimeVersionCommandSupported(
  expoUpdatesPackageVersion: string
): boolean {
  if (expoUpdatesPackageVersion.includes('canary')) {
    return true;
  }

  // Anything SDK 51 or greater uses the expo-updates CLI
  return semver.gte(expoUpdatesPackageVersion, '0.25.4');
}

async function logDiffFingerprints({
  resolvedRuntime,
  ctx,
}: {
  resolvedRuntime: ResolvedRuntime;
  ctx: BuildContext<BuildJob>;
}): Promise<void> {
  const { resolvedRuntimeVersion, resolvedFingerprintSources } = resolvedRuntime;
  if (ctx.metadata?.fingerprintSource && resolvedFingerprintSources && resolvedRuntimeVersion) {
    try {
      const fingerprintSource = ctx.metadata.fingerprintSource;

      let localFingerprint: Fingerprint | null = null;

      if (fingerprintSource.type === FingerprintSourceType.URL) {
        const result = await fetch(fingerprintSource.url);
        localFingerprint = await result.json();
      } else if (fingerprintSource.type === FingerprintSourceType.PATH) {
        localFingerprint = await fs.readJson(fingerprintSource.path);
      } else {
        ctx.logger.warn(`Invalid fingerprint source type: ${fingerprintSource.type}`);
      }

      if (localFingerprint) {
        const easFingerprint = {
          hash: resolvedRuntimeVersion,
          sources: resolvedFingerprintSources,
        };
        const changes = diffFingerprints(localFingerprint, easFingerprint);
        if (changes.length) {
          ctx.logger.warn('Difference between local and EAS fingerprints:');
          ctx.logger.warn(stringifyFingerprintDiff(changes));
        }
      }
    } catch (error) {
      ctx.logger.warn('Failed to compare fingerprints', error);
    }
  }
}
