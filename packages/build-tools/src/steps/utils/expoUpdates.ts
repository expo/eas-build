import { Job, Platform } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import { ExpoConfig } from '@expo/config';
import { getRuntimeVersionNullableAsync } from '@expo/config-plugins/build/utils/Updates';

import getExpoUpdatesPackageVersionIfInstalledAsync from '../../utils/getExpoUpdatesPackageVersionIfInstalledAsync';

import {
  iosGetNativelyDefinedChannelAsync,
  iosSetChannelNativelyAsync,
  iosSetRuntimeVersionNativelyAsync,
} from './ios/expoUpdates';
import {
  androidGetNativelyDefinedChannelAsync,
  androidSetChannelNativelyAsync,
  androidSetRuntimeVersionNativelyAsync,
} from './android/expoUpdates';

export async function configureEASUpdateIfInstalledAsync({
  job,
  workingDirectory,
  logger,
  inputs,
  appConfig,
}: {
  job: Job;
  workingDirectory: string;
  logger: bunyan;
  inputs: {
    runtimeVersion?: string;
    channel?: string;
    throwIfNotConfigured: boolean;
  };
  appConfig: ExpoConfig;
}): Promise<void> {
  const expoUpdatesPackageVersion =
    await getExpoUpdatesPackageVersionIfInstalledAsync(workingDirectory);
  if (expoUpdatesPackageVersion === null) {
    if (inputs.throwIfNotConfigured) {
      logger.error(
        'Cannot configure EAS Update because the expo-updates package is not installed.'
      );
      throw new Error(
        'Cannot configure EAS Update because the expo-updates package is not installed.'
      );
    }
    logger.warn('Cannot configure EAS Update because the expo-updates package is not installed.');
    return;
  }

  const runtimeVersion =
    inputs.channel ??
    job.version?.runtimeVersion ??
    (await getRuntimeVersionNullableAsync(workingDirectory, appConfig, job.platform));

  const jobOrInputChannel = inputs.channel ?? job.updates?.channel;

  if (isEASUpdateConfigured(appConfig, logger)) {
    const channel = jobOrInputChannel ?? (await getChannelAsync(job, workingDirectory));
    if (channel) {
      await configureEASUpdate(job, logger, channel, workingDirectory);
    } else {
      if (job.releaseChannel !== undefined) {
        logger.warn(
          `This build is configured with EAS Update however has a Classic Updates releaseChannel set instead of having an EAS Update channel.`
        );
      } else {
        logger.warn(
          `This build is configured to query EAS Update for updates, however no channel is set.`
        );
      }
    }
  } else {
    logger.info(`Expo Updates is not configured, skipping configuring Expo Updates.`);
  }

  if (runtimeVersion) {
    logger.info('Updating runtimeVersion in Expo.plist');
    await setRuntimeVersionNativelyAsync(job, runtimeVersion, workingDirectory);
  }
}

export function isEASUpdateConfigured(appConfig: ExpoConfig, logger: bunyan): boolean {
  const rawUrl = appConfig.updates?.url;
  if (!rawUrl) {
    return false;
  }
  try {
    const url = new URL(rawUrl);
    return ['u.expo.dev', 'staging-u.expo.dev'].includes(url.hostname);
  } catch (err) {
    logger.error({ err }, `Cannot parse expo.updates.url = ${rawUrl} as URL`);
    logger.error(`Assuming EAS Update is not configured`);
    return false;
  }
}

async function configureEASUpdate(
  job: Job,
  logger: bunyan,
  channel: string,
  workingDirectory: string
): Promise<void> {
  const newUpdateRequestHeaders: Record<string, string> = {
    'expo-channel-name': channel,
  };

  const configFile = job.platform === Platform.ANDROID ? 'AndroidManifest.xml' : 'Expo.plist';
  logger.info(
    `Setting the update request headers in '${configFile}' to '${JSON.stringify(
      newUpdateRequestHeaders
    )}'`
  );

  switch (job.platform) {
    case Platform.ANDROID: {
      await androidSetChannelNativelyAsync(channel, workingDirectory);
      return;
    }
    case Platform.IOS: {
      await iosSetChannelNativelyAsync(channel, workingDirectory);
      return;
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

async function getChannelAsync(job: Job, workingDirectory: string): Promise<string | null> {
  switch (job.platform) {
    case Platform.ANDROID: {
      return await androidGetNativelyDefinedChannelAsync(workingDirectory);
    }
    case Platform.IOS: {
      return await iosGetNativelyDefinedChannelAsync(workingDirectory);
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}

async function setRuntimeVersionNativelyAsync(
  job: Job,
  runtimeVersion: string,
  workingDirectory: string
): Promise<void> {
  switch (job.platform) {
    case Platform.ANDROID: {
      await androidSetRuntimeVersionNativelyAsync(runtimeVersion, workingDirectory);
      return;
    }
    case Platform.IOS: {
      await iosSetRuntimeVersionNativelyAsync(runtimeVersion, workingDirectory);
      return;
    }
    default:
      throw new Error(`Platform is not supported.`);
  }
}
