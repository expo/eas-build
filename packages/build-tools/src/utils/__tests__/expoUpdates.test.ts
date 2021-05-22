import { Platform } from '@expo/eas-build-job';

import { ManagedBuildContext, ManagedJob } from '../../managed/context';
import * as expoUpdates from '../expoUpdates';
import isExpoUpdatesInstalledAsync from '../isExpoUpdatesInstalled';

jest.mock('../isExpoUpdatesInstalled', () => jest.fn());
jest.mock('fs');

describe(expoUpdates.configureExpoUpdatesIfInstalledAsync, () => {
  it('aborts if expo-updates is not installed', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(false);
    jest.spyOn(expoUpdates, 'configureEASExpoUpdatesAsync');
    jest.spyOn(expoUpdates, 'configureClassicExpoUpdatesAsync');

    await expoUpdates.configureExpoUpdatesIfInstalledAsync({} as any, Platform.IOS);

    expect(expoUpdates.configureEASExpoUpdatesAsync).not.toBeCalled();
    expect(expoUpdates.configureClassicExpoUpdatesAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toHaveBeenCalledTimes(1);
  });

  it('configures for EAS if the updates.channel field is set', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);
    jest.spyOn(expoUpdates, 'configureEASExpoUpdatesAsync').mockImplementation();
    jest.spyOn(expoUpdates, 'configureClassicExpoUpdatesAsync');

    const managedCtx: ManagedBuildContext<ManagedJob> = {
      job: { updates: { channel: 'main' } },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx, Platform.IOS);

    expect(expoUpdates.configureEASExpoUpdatesAsync).toBeCalledTimes(1);
    expect(expoUpdates.configureClassicExpoUpdatesAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toHaveBeenCalledTimes(1);
  });

  it('configures for classic updates if the updates.channel field is not set', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);
    jest.spyOn(expoUpdates, 'configureEASExpoUpdatesAsync').mockImplementation();
    jest.spyOn(expoUpdates, 'configureClassicExpoUpdatesAsync');

    const managedCtx: ManagedBuildContext<ManagedJob> = {
      job: {},
      logger: { info: () => {} },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx, Platform.IOS);

    expect(expoUpdates.configureEASExpoUpdatesAsync).not.toBeCalled();
    expect(expoUpdates.configureClassicExpoUpdatesAsync).toBeCalledTimes(1);
    expect(isExpoUpdatesInstalledAsync).toHaveBeenCalledTimes(1);
  });
});

describe(expoUpdates.configureClassicExpoUpdatesAsync, () => {
  it('sets the release channel if it is supplied in ctx.job.releaseChannel', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);
    jest.spyOn(expoUpdates, 'setReleaseChannelNativelyAsync').mockImplementation();

    const managedCtx: ManagedBuildContext<ManagedJob> = {
      job: { releaseChannel: 'default' },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx, Platform.IOS);

    expect(expoUpdates.setReleaseChannelNativelyAsync).toBeCalledTimes(1);
  });
  it('searches for the natively defined releaseChannel if it is not supplied by ctx.job.releaseChannel', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);
    jest.spyOn(expoUpdates, 'getNativelyDefinedReleaseChannelAsync').mockImplementation();

    const managedCtx: ManagedBuildContext<ManagedJob> = {
      job: {},
      logger: { info: () => {}, warn: () => {} },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx, Platform.IOS);

    expect(expoUpdates.getNativelyDefinedReleaseChannelAsync).toBeCalledTimes(1);
  });
  it('uses the default release channel if the releaseChannel is not defined in ctx.job.releaseChannel nor natively.', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);
    jest.spyOn(expoUpdates, 'getNativelyDefinedReleaseChannelAsync').mockImplementation(() => {
      throw new Error();
    });

    const infoLogger = jest.fn();
    const managedCtx: ManagedBuildContext<ManagedJob> = {
      job: {},
      logger: { info: infoLogger },
    } as any;
    await expoUpdates.configureExpoUpdatesIfInstalledAsync(managedCtx, Platform.IOS);

    expect(infoLogger).toBeCalledWith(`Using default release channel for 'expo-updates' (default)`);
  });
});

describe(expoUpdates.configureEASExpoUpdatesAsync, () => {
  // maybe an e2e test instead of just the mocked out calls for the two functions as well?
});
