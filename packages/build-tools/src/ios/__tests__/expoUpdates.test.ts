import fs from 'fs-extra';
import plist from '@expo/plist';
import { vol } from 'memfs';

import {
  iosGetNativelyDefinedClassicReleaseChannelAsync,
  IosMetadataName,
  iosSetChannelNativelyAsync,
  iosGetNativelyDefinedChannelAsync,
  iosSetClassicReleaseChannelNativelyAsync,
  iosGetNativelyDefinedRuntimeVersionAsync,
  iosSetRuntimeVersionNativelyAsync,
} from '../../ios/expoUpdates';

jest.mock('fs');

const expoPlistPath = '/app/ios/testapp/Supporting/Expo.plist';
const noItemsExpoPlist = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
  </dict>
</plist>`;
const channel = 'easupdatechannel';

afterEach(() => {
  vol.reset();
});

describe(iosSetClassicReleaseChannelNativelyAsync, () => {
  test('sets the release channel', async () => {
    const releaseChannel = 'examplechannel';
    vol.fromJSON(
      {
        'ios/testapp/Supporting/Expo.plist': noItemsExpoPlist,
        'ios/testapp.xcodeproj/project.pbxproj': 'placeholder',
        'ios/testapp/AppDelegate.m': 'placeholder',
      },
      '/app',
    );

    const ctx = {
      getReactNativeProjectDirectory: () => '/app',
      job: { releaseChannel },
      logger: { info: () => {} },
    };
    await iosSetClassicReleaseChannelNativelyAsync(ctx as any);

    const newExpoPlist = await fs.readFile(expoPlistPath, 'utf8');
    expect(plist.parse(newExpoPlist)[IosMetadataName.RELEASE_CHANNEL]).toEqual(releaseChannel);
  });
});

describe(iosSetChannelNativelyAsync, () => {
  it('sets the channel', async () => {
    vol.fromJSON(
      {
        'ios/testapp/Supporting/Expo.plist': noItemsExpoPlist,
        'ios/testapp.xcodeproj/project.pbxproj': 'placeholder',
        'ios/testapp/AppDelegate.m': 'placeholder',
      },
      '/app',
    );

    const ctx = {
      getReactNativeProjectDirectory: () => '/app',
      job: { updates: { channel } },
      logger: { info: () => {} },
    };
    await iosSetChannelNativelyAsync(ctx as any);

    const newExpoPlist = await fs.readFile(expoPlistPath, 'utf8');
    expect(
      plist.parse(newExpoPlist)[IosMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY],
    ).toEqual({ 'expo-channel-name': channel });
  });
});

describe(iosGetNativelyDefinedChannelAsync, () => {
  it('gets the channel', async () => {
    const expoPlist = `
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
        <dict>
          <key>EXUpdatesRequestHeaders</key>
          <dict>
            <key>expo-channel-name</key>
            <string>staging-123</string>
          </dict>
        </dict>
      </plist>
    `;

    vol.fromJSON(
      {
        'ios/testapp/Supporting/Expo.plist': expoPlist,
        'ios/testapp.xcodeproj/project.pbxproj': 'placeholder',
        'ios/testapp/AppDelegate.m': 'placeholder',
      },
      '/app',
    );

    const ctx = {
      getReactNativeProjectDirectory: () => '/app',
      logger: { info: () => {} },
    };
    await expect(iosGetNativelyDefinedChannelAsync(ctx as any)).resolves.toBe('staging-123');
  });
});

describe(iosGetNativelyDefinedClassicReleaseChannelAsync, () => {
  it('gets the natively defined release channel', async () => {
    const expoPlist = `
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
      <dict>
        <key>EXUpdatesReleaseChannel</key>
        <string>examplechannel</string>
      </dict>
    </plist>`;

    vol.fromJSON(
      {
        'ios/testapp/Supporting/Expo.plist': expoPlist,
        'ios/testapp.xcodeproj/project.pbxproj': 'placeholder',
        'ios/testapp/AppDelegate.m': 'placeholder',
      },
      '/app',
    );

    const ctx = {
      getReactNativeProjectDirectory: () => '/app',
      logger: { info: () => {} },
    };
    const nativelyDefinedReleaseChannel = await iosGetNativelyDefinedClassicReleaseChannelAsync(
      ctx as any,
    );

    expect(nativelyDefinedReleaseChannel).toBe('examplechannel');
  });
});

describe(iosGetNativelyDefinedRuntimeVersionAsync, () => {
  it('gets the natively defined runtime version', async () => {
    const expoPlist = `
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
      <dict>
        <key>EXUpdatesRuntimeVersion</key>
        <string>4.5.6</string>
      </dict>
    </plist>`;

    vol.fromJSON(
      {
        'ios/testapp/Supporting/Expo.plist': expoPlist,
        'ios/testapp.xcodeproj/project.pbxproj': 'placeholder',
        'ios/testapp/AppDelegate.m': 'placeholder',
      },
      '/app',
    );

    const ctx = {
      getReactNativeProjectDirectory: () => '/app',
      logger: { info: () => {} },
    };

    const nativelyDefinedRuntimeVersion = await iosGetNativelyDefinedRuntimeVersionAsync(
      ctx as any,
    );
    expect(nativelyDefinedRuntimeVersion).toBe('4.5.6');
  });
});

describe(iosSetRuntimeVersionNativelyAsync, () => {
  it("sets runtime version if it's not specified", async () => {
    vol.fromJSON(
      {
        'ios/testapp/Supporting/Expo.plist': noItemsExpoPlist,
        'ios/testapp.xcodeproj/project.pbxproj': 'placeholder',
        'ios/testapp/AppDelegate.m': 'placeholder',
      },
      '/app',
    );
    const ctx = {
      getReactNativeProjectDirectory: () => '/app',
      logger: { info: () => {} },
    };

    await iosSetRuntimeVersionNativelyAsync(ctx as any, '1.2.3');

    const newExpoPlist = await fs.readFile(expoPlistPath, 'utf8');
    expect(plist.parse(newExpoPlist)[IosMetadataName.RUNTIME_VERSION]).toEqual('1.2.3');
  });
  it("updates runtime version if it's already defined", async () => {
    const expoPlist = `
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
      <dict>
        <key>RELEASE_CHANNEL</key>
        <string>examplereleasechannel</string>
      </dict>
    </plist>`;

    vol.fromJSON(
      {
        'ios/testapp/Supporting/Expo.plist': expoPlist,
        'ios/testapp.xcodeproj/project.pbxproj': 'placeholder',
        'ios/testapp/AppDelegate.m': 'placeholder',
      },
      '/app',
    );
    const ctx = {
      getReactNativeProjectDirectory: () => '/app',
      logger: { info: () => {} },
    };

    await iosSetRuntimeVersionNativelyAsync(ctx as any, '1.2.3');

    const newExpoPlist = await fs.readFile(expoPlistPath, 'utf8');
    expect(plist.parse(newExpoPlist)[IosMetadataName.RUNTIME_VERSION]).toEqual('1.2.3');
  });
});
