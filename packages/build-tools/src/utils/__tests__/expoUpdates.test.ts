import { Platform, Job } from '@expo/eas-build-job';

import { BuildContext } from '../../context';
import * as expoUpdates from '../expoUpdates';
import getExpoUpdatesPackageVersionIfInstalledAsync from '../getExpoUpdatesPackageVersionIfInstalledAsync';
import {
  iosSetChannelNativelyAsync,
  iosSetClassicReleaseChannelNativelyAsync,
  iosGetNativelyDefinedClassicReleaseChannelAsync,
} from '../../ios/expoUpdates';
import {
  androidSetChannelNativelyAsync,
  androidSetClassicReleaseChannelNativelyAsync,
  androidGetNativelyDefinedClassicReleaseChannelAsync,
} from '../../android/expoUpdates';

jest.mock('../getExpoUpdatesPackageVersionIfInstalledAsync');
jest.mock('../../ios/expoUpdates');
jest.mock('../../android/expoUpdates');
jest.mock('fs');

describe(expoUpdates.configureExpoUpdatesIfInstalledAsync, () => {
  beforeAll(() => {
    jest.restoreAllMocks();
  });

  it('aborts if expo-updates is not installed', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue(null);

    await expoUpdates.configureExpoUpdatesIfInstalledAsync({
      job: { Platform: Platform.IOS },
      getReactNativeProjectDirectory: () => '/app',
    } as any);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(getExpoUpdatesPackageVersionIfInstalledAsync).toBeCalledTimes(1);
  });

  it('aborts if updates.url (app config) is set but updates.channel (eas.json) is not', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.18.0');

    const managedCtx: BuildContext<Job> = {
      appConfig: {
        updates: {
          url: 'https://u.expo.dev/blahblah',
        },
      },
      job: {
        platform: Platform.IOS,
      },
      logger: { info: () => {} },
      getReactNativeProjectDirectory: () => '/app',
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(getExpoUpdatesPackageVersionIfInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for EAS if updates.channel (eas.json) and updates.url (app config) are set', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.18.0');

    const managedCtx: BuildContext<Job> = {
      appConfig: {
        updates: {
          url: 'https://u.expo.dev/blahblah',
        },
      },
      job: {
        updates: {
          channel: 'main',
        },
        platform: Platform.IOS,
      },
      logger: { info: () => {} },
      getReactNativeProjectDirectory: () => '/app',
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(getExpoUpdatesPackageVersionIfInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for EAS if the updates.channel and releaseChannel are both set', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.18.0');

    const managedCtx: BuildContext<Job> = {
      appConfig: {
        updates: {
          url: 'https://u.expo.dev/blahblah',
        },
      },
      job: { updates: { channel: 'main' }, releaseChannel: 'default', platform: Platform.IOS },
      logger: { info: () => {} },
      getReactNativeProjectDirectory: () => '/app',
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(getExpoUpdatesPackageVersionIfInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for classic updates if the updates.channel and releaseChannel fields (eas.json) are not set, and updates.url (app config) is not set, and expo-updates version is < 0.19.0', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.18.0');

    const managedCtx: BuildContext<Job> = {
      appConfig: { updates: {} },
      job: { platform: Platform.IOS },
      logger: { info: () => {} },
      getReactNativeProjectDirectory: () => '/app',
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).toBeCalledTimes(1);
    expect(getExpoUpdatesPackageVersionIfInstalledAsync).toBeCalledTimes(1);
  });

  it('does not configure for classic updates if the updates.channel and releaseChannel fields (eas.json) are not set, and updates.url (app config) is not set, and expo-updates version is >= 0.19.0', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.19.0');

    const managedCtx: BuildContext<Job> = {
      appConfig: { updates: {} },
      job: { platform: Platform.IOS },
      logger: { info: () => {} },
      getReactNativeProjectDirectory: () => '/app',
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
    expect(getExpoUpdatesPackageVersionIfInstalledAsync).toBeCalledTimes(1);
  });

  it('sets the release channel if it is supplied in ctx.job.releaseChannel, and expo-updates version is < 0.19.0', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.18.0');

    const managedCtx: BuildContext<Job> = {
      appConfig: {},
      job: { releaseChannel: 'default', platform: Platform.IOS },
      logger: { info: () => {} },
      getReactNativeProjectDirectory: () => '/app',
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(iosSetClassicReleaseChannelNativelyAsync).toBeCalledTimes(1);
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
    expect(androidGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
  });

  it('does not set the release channel if it is supplied in ctx.job.releaseChannel, and expo-updates version is >= 0.19.0', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.19.0');

    const managedCtx: BuildContext<Job> = {
      appConfig: {},
      job: { releaseChannel: 'default', platform: Platform.IOS },
      logger: { info: () => {} },
      getReactNativeProjectDirectory: () => '/app',
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
    expect(androidGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
  });

  it('uses the default release channel if the releaseChannel is not defined in ctx.job.releaseChannel nor natively, and expo-updates version is < 0.19.0', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.18.0');

    const infoLogger = jest.fn();
    const managedCtx: BuildContext<Job> = {
      appConfig: {},
      job: { platform: Platform.IOS },
      logger: { info: infoLogger, warn: () => {} },
      getReactNativeProjectDirectory: () => '/app',
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(infoLogger).toBeCalledWith(`Using default release channel for 'expo-updates' (default)`);
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(androidGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).toBeCalledTimes(1);
  });

  it('does not use the default release channel if the releaseChannel is not defined in ctx.job.releaseChannel nor natively, and expo-updates version is >= 0.19.0', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.19.0');

    const infoLogger = jest.fn();
    const managedCtx: BuildContext<Job> = {
      appConfig: {},
      job: { platform: Platform.IOS },
      logger: { info: infoLogger, warn: () => {} },
      getReactNativeProjectDirectory: () => '/app',
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(infoLogger).not.toBeCalledWith(
      `Using default release channel for 'expo-updates' (default)`
    );
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(androidGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
  });

  it('does not use the default release channel if the releaseChannel is not defined in ctx.job.releaseChannel nor natively, and expo-updates version is canary', async () => {
    jest
      .mocked(getExpoUpdatesPackageVersionIfInstalledAsync)
      .mockResolvedValue('0.0.1-canary-20240109-93608d8');

    const infoLogger = jest.fn();
    const managedCtx: BuildContext<Job> = {
      appConfig: {},
      job: { platform: Platform.IOS },
      logger: { info: infoLogger, warn: () => {} },
      getReactNativeProjectDirectory: () => '/app',
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(infoLogger).not.toBeCalledWith(
      `Using default release channel for 'expo-updates' (default)`
    );
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(androidGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
  });
});
