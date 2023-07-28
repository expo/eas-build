import { Platform, Job } from '@expo/eas-build-job';
import { createLogger } from '@expo/logger';
import { ExpoConfig } from '@expo/config';

import { configureEASUpdateIfInstalledAsync } from '../expoUpdates';
import isExpoUpdatesInstalledAsync from '../../../utils/isExpoUpdatesInstalled';
import { androidSetChannelNativelyAsync } from '../android/expoUpdates';
import { iosSetChannelNativelyAsync } from '../ios/expoUpdates';

jest.mock('../../../utils/isExpoUpdatesInstalled', () => jest.fn());
jest.mock('../ios/expoUpdates');
jest.mock('../android/expoUpdates');
jest.mock('fs');

describe(configureEASUpdateIfInstalledAsync, () => {
  beforeAll(() => {
    jest.restoreAllMocks();
  });

  it('aborts if expo-updates is not installed', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(false);

    await configureEASUpdateIfInstalledAsync({
      job: { platform: Platform.IOS } as unknown as Job,
      workingDirectory: '/app',
      logger: createLogger({
        name: 'test',
      }),
      appConfig: {} as unknown as ExpoConfig,
      inputs: {},
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });

  it('aborts if updates.url (app config) is set but updates.channel (eas.json) is not', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    await configureEASUpdateIfInstalledAsync({
      job: { platform: Platform.IOS } as unknown as Job,
      workingDirectory: '/app',
      logger: createLogger({
        name: 'test',
      }),
      appConfig: {
        updates: {
          url: 'https://u.expo.dev/blahblah',
        },
      } as unknown as ExpoConfig,
      inputs: {},
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for EAS if updates.channel (eas.json) and updates.url (app config) are set', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    await configureEASUpdateIfInstalledAsync({
      job: {
        updates: {
          channel: 'main',
        },
        platform: Platform.IOS,
      } as unknown as Job,
      workingDirectory: '/app',
      logger: createLogger({
        name: 'test',
      }),
      appConfig: {
        updates: {
          url: 'https://u.expo.dev/blahblah',
        },
      } as unknown as ExpoConfig,
      inputs: {},
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for EAS if the updates.channel and releaseChannel are both set', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    await configureEASUpdateIfInstalledAsync({
      job: {
        updates: { channel: 'main' },
        releaseChannel: 'default',
        platform: Platform.IOS,
      } as unknown as Job,
      workingDirectory: '/app',
      logger: createLogger({
        name: 'test',
      }),
      appConfig: {
        updates: {
          url: 'https://u.expo.dev/blahblah',
        },
      } as unknown as ExpoConfig,
      inputs: {},
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for classic updates if the updates.channel and releaseChannel fields (eas.json) are not set, and updates.url (app config) is not set', async () => {
    (isExpoUpdatesInstalledAsync as jest.Mock).mockReturnValue(true);

    await configureEASUpdateIfInstalledAsync({
      job: { platform: Platform.IOS } as unknown as Job,
      workingDirectory: '/app',
      logger: createLogger({
        name: 'test',
      }),
      appConfig: {
        updates: {},
      } as unknown as ExpoConfig,
      inputs: {},
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(isExpoUpdatesInstalledAsync).toBeCalledTimes(1);
  });
});
