import { Platform, Job } from '@expo/eas-build-job';
import { createLogger } from '@expo/logger';
import { ExpoConfig } from '@expo/config';

import { configureEASUpdateIfInstalledAsync } from '../expoUpdates';
import getExpoUpdatesPackageVersionIfInstalledAsync from '../../../utils/getExpoUpdatesPackageVersionIfInstalledAsync';
import { androidSetChannelNativelyAsync } from '../android/expoUpdates';
import { iosSetChannelNativelyAsync } from '../ios/expoUpdates';
import { androidSetClassicReleaseChannelNativelyAsync } from '../../../android/expoUpdates';
import { iosSetClassicReleaseChannelNativelyAsync } from '../../../ios/expoUpdates';

jest.mock('../../../utils/getExpoUpdatesPackageVersionIfInstalledAsync');
jest.mock('../ios/expoUpdates');
jest.mock('../../../ios/expoUpdates');
jest.mock('../android/expoUpdates');
jest.mock('../../../android/expoUpdates');
jest.mock('fs');

describe(configureEASUpdateIfInstalledAsync, () => {
  beforeAll(() => {
    jest.restoreAllMocks();
  });

  it('aborts if expo-updates is not installed', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue(null);

    await expect(
      configureEASUpdateIfInstalledAsync({
        job: { platform: Platform.IOS } as unknown as Job,
        workingDirectory: '/app',
        logger: createLogger({
          name: 'test',
        }),
        appConfig: {} as unknown as ExpoConfig,
        inputs: {
          throwIfNotConfigured: true,
        },
      })
    ).rejects.toThrowError(
      'Cannot configure EAS Update because the expo-updates package is not installed.'
    );

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(getExpoUpdatesPackageVersionIfInstalledAsync).toBeCalledTimes(1);
  });

  it('aborts if updates.url (app config) is set but updates.channel (eas.json) is not', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.18.0');

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
      inputs: {
        throwIfNotConfigured: true,
      },
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(getExpoUpdatesPackageVersionIfInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for EAS if updates.channel (eas.json) and updates.url (app config) are set', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.18.0');

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
      inputs: {
        throwIfNotConfigured: true,
      },
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(getExpoUpdatesPackageVersionIfInstalledAsync).toBeCalledTimes(1);
  });

  it('configures for EAS if the updates.channel and releaseChannel are both set', async () => {
    jest.mocked(getExpoUpdatesPackageVersionIfInstalledAsync).mockResolvedValue('0.18.0');

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
      inputs: {
        throwIfNotConfigured: true,
      },
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(getExpoUpdatesPackageVersionIfInstalledAsync).toBeCalledTimes(1);
  });
});
