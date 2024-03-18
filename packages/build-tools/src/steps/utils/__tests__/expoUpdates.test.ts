import { Platform, Job } from '@expo/eas-build-job';
import { createLogger } from '@expo/logger';
import { ExpoConfig } from '@expo/config';

import { configureEASUpdateAsync } from '../expoUpdates';
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

describe(configureEASUpdateAsync, () => {
  beforeAll(() => {
    jest.restoreAllMocks();
  });

  it('aborts if updates.url (app config) is set but updates.channel (eas.json) is not', async () => {
    await configureEASUpdateAsync({
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
      metadata: null,
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).not.toBeCalled();
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
  });

  it('configures for EAS if updates.channel (eas.json) and updates.url (app config) are set', async () => {
    await configureEASUpdateAsync({
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
      metadata: null,
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
  });

  it('configures for EAS if the updates.channel and releaseChannel are both set', async () => {
    await configureEASUpdateAsync({
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
      metadata: null,
    });

    expect(androidSetChannelNativelyAsync).not.toBeCalled();
    expect(androidSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
    expect(iosSetChannelNativelyAsync).toBeCalledTimes(1);
    expect(iosSetClassicReleaseChannelNativelyAsync).not.toBeCalled();
  });
});
