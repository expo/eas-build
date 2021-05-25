import { Platform } from '@expo/eas-build-job';

import { ManagedBuildContext, ManagedJob } from '../../managed/context';
import * as expoUpdates from '../expoUpdates';
import isExpoUpdatesInstalledAsync from '../isExpoUpdatesInstalled';

jest.mock('../isExpoUpdatesInstalled', () => jest.fn());
jest.mock('fs');

describe(expoUpdates.configureExpoUpdatesIfInstalledAsync, () => {
  beforeAll(() => {
    jest.restoreAllMocks();
  });
  it('aborts if expo-updates is not installed', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(false);
    jest.spyOn(expoUpdates, 'configureEASExpoUpdatesAsync');
    jest.spyOn(expoUpdates, 'configureClassicExpoUpdatesAsync');

    await expoUpdates.configureExpoUpdatesIfInstalledAsync({
      job: { Platform: Platform.IOS },
    } as any);

    expect(expoUpdates.configureEASExpoUpdatesAsync).not.toBeCalled();
    expect(expoUpdates.configureClassicExpoUpdatesAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toHaveBeenCalledTimes(1);
  });

  it('configures for EAS if the updates.channel field is set', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);
    jest.spyOn(expoUpdates, 'configureEASExpoUpdatesAsync').mockImplementation();
    jest.spyOn(expoUpdates, 'configureClassicExpoUpdatesAsync');

    const managedCtx: ManagedBuildContext<ManagedJob> = {
      job: { updates: { channel: 'main' }, Platform: Platform.IOS },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(expoUpdates.configureEASExpoUpdatesAsync).toBeCalledTimes(1);
    expect(expoUpdates.configureClassicExpoUpdatesAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toHaveBeenCalledTimes(1);
  });

  it('configures for classic updates if the updates.channel field is not set', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);
    jest.spyOn(expoUpdates, 'configureEASExpoUpdatesAsync');
    jest.spyOn(expoUpdates, 'configureClassicExpoUpdatesAsync').mockImplementation();

    const managedCtx: ManagedBuildContext<ManagedJob> = {
      job: { platform: Platform.IOS },
      logger: { info: () => {} },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(expoUpdates.configureEASExpoUpdatesAsync).not.toBeCalled();
    expect(expoUpdates.configureClassicExpoUpdatesAsync).toBeCalledTimes(1);
    expect(isExpoUpdatesInstalledAsync).toHaveBeenCalledTimes(1);
  });
});

describe(expoUpdates.configureClassicExpoUpdatesAsync, () => {
  beforeAll(() => {
    jest.restoreAllMocks();
  });
  it('sets the release channel if it is supplied in ctx.job.releaseChannel', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);
    jest.spyOn(expoUpdates, 'setClassicReleaseChannelNativelyAsync').mockImplementation();

    const managedCtx: ManagedBuildContext<ManagedJob> = {
      job: { releaseChannel: 'default', platform: Platform.IOS },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(expoUpdates.setClassicReleaseChannelNativelyAsync).toBeCalledTimes(1);
  });
  it('searches for the natively defined releaseChannel if it is not supplied by ctx.job.releaseChannel', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);
    jest.spyOn(expoUpdates, 'getNativelyDefinedClassicReleaseChannelAsync').mockImplementation();

    const managedCtx: ManagedBuildContext<ManagedJob> = {
      job: { platform: Platform.IOS },
      logger: { info: () => {}, warn: () => {} },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(expoUpdates.getNativelyDefinedClassicReleaseChannelAsync).toBeCalledTimes(1);
  });
  it('uses the default release channel if the releaseChannel is not defined in ctx.job.releaseChannel nor natively.', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);
    jest
      .spyOn(expoUpdates, 'getNativelyDefinedClassicReleaseChannelAsync')
      .mockImplementation(async () => {
        return null;
      });

    const infoLogger = jest.fn();
    const managedCtx: ManagedBuildContext<ManagedJob> = {
      job: { platform: Platform.IOS },
      logger: { info: infoLogger },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx);

    expect(infoLogger).toBeCalledWith(`Using default release channel for 'expo-updates' (default)`);
  });
});
