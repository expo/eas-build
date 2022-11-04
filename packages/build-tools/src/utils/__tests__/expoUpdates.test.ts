import { Platform, Job } from '@expo/eas-build-job';

import { BuildContext } from '../../context';
import * as expoUpdates from '../expoUpdates';
import isExpoUpdatesInstalledAsync from '../isExpoUpdatesInstalled';
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

jest.mock('../isExpoUpdatesInstalled', () => jest.fn());
jest.mock('../../ios/expoUpdates');
jest.mock('../../android/expoUpdates');
jest.mock('fs');

describe(expoUpdates.configureExpoUpdatesIfInstalledAsync, () => {
  beforeAll(() => {
    jest.restoreAllMocks();
  });
  it('aborts if expo-updates is not installed', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(false);

    await expoUpdates.configureExpoUpdatesIfInstalledAsync({
      job: { Platform: Platform.IOS },
    } as any);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for EAS if the updates.channel and updates.url fields are set', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    const managedCtx: BuildContext<Job> = {
      job: { updates: { channel: 'main' }, platform: Platform.IOS },
      logger: { info: () => {} },
      appConfig: {
        updates: { url: 'http://sokal.dev/blah' },
      },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for EAS if the updates.channel and releaseChannel are both set', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    const managedCtx: BuildContext<Job> = {
      job: { updates: { channel: 'main' }, releaseChannel: 'default', platform: Platform.IOS },
      logger: { info: () => {} },
      appConfig: {
        updates: { url: 'http://sokal.dev/blah' },
      },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(iosSetChannelNativelyAsync).toBeCalledWith(expect.anything(), 'main');
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for EAS if the updates.channel is not set but updates.url is (defaults to the build profile name)', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    const managedCtx: BuildContext<Job> = {
      job: { platform: Platform.IOS },
      logger: { info: () => {} },
      appConfig: {
        updates: { url: 'http://sokal.dev/blah' },
      },
      metadata: {
        buildProfile: 'production',
      },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(iosSetChannelNativelyAsync).toBeCalledWith(expect.anything(), 'production');
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for classic updates if the updates.channel is set but updates.url is missing', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    const managedCtx: BuildContext<Job> = {
      job: { updates: { channel: 'main' }, platform: Platform.IOS },
      logger: { info: () => {} },
      appConfig: {},
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).toBeCalledTimes(1);
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for classic updates if the updates.channel and releaseChannel fields are not set', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    const managedCtx: BuildContext<Job> = {
      job: { platform: Platform.IOS },
      logger: { info: () => {} },
      appConfig: {
        updates: { url: 'http://sokal.dev/blah' },
      },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).toBeCalledTimes(1);
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });

  it('sets the release channel if it is supplied in ctx.job.releaseChannel', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    const managedCtx: BuildContext<Job> = {
      job: { releaseChannel: 'default', platform: Platform.IOS },
      logger: { info: () => {} },
      appConfig: {
        updates: { url: 'http://sokal.dev/blah' },
      },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(iosSetClassicReleaseChannelNativelyAsync).toBeCalledTimes(1);
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
    expect(androidGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
  });

  it('uses the default release channel if the releaseChannel is not defined in ctx.job.releaseChannel nor natively.', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    const infoLogger = jest.fn();
    const managedCtx: BuildContext<Job> = {
      job: { platform: Platform.IOS },
      logger: { info: infoLogger, warn: () => {} },
      appConfig: {
        updates: { url: 'http://sokal.dev/blah' },
      },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(infoLogger).toBeCalledWith(`Using default release channel for 'expo-updates' (default)`);
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(androidGetNativelyDefinedClassicReleaseChannelAsync).not.toBeCalled();
    expect(iosGetNativelyDefinedClassicReleaseChannelAsync).toBeCalledTimes(1);
  });
});
