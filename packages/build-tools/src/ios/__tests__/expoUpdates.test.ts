import path from 'path';

import fs from 'fs-extra';
import plist from '@expo/plist';

import {
  getExpoPlistDirectoryAsync,
  iosGetNativelyDefinedReleaseChannelAsync,
  IosMetadataName,
  iosSetChannelNativelyAsync,
  iosSetReleaseChannelNativelyAsync,
} from '../../ios/expoUpdates';

jest.mock('fs');

const noItemsExpoPlist = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
  </dict>
</plist>`;
const channel = 'main';

describe(iosSetReleaseChannelNativelyAsync, () => {
  test('sets the release channel', async () => {
    const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
    fs.ensureDirSync(reactNativeProjectDirectory);
    const releaseChannel = 'default';
    const ctx = {
      reactNativeProjectDirectory,
      job: { releaseChannel },
      logger: { info: () => {} },
    };

    fs.ensureDirSync(path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/'));
    fs.writeFileSync(
      path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/project.pbxproj'),
      Buffer.from('placeholder')
    );

    const expoPlistDirectory = await getExpoPlistDirectoryAsync(reactNativeProjectDirectory);
    const expoPlistPath = path.join(expoPlistDirectory, 'Expo.plist');

    fs.ensureDirSync(expoPlistDirectory);
    fs.writeFileSync(expoPlistPath, noItemsExpoPlist);

    await iosSetReleaseChannelNativelyAsync(ctx as any);

    const newExpoPlist = await fs.readFile(expoPlistPath, 'utf8');
    expect(plist.parse(newExpoPlist)[IosMetadataName.RELEASE_CHANNEL]).toEqual(releaseChannel);
  });
});

describe(iosSetChannelNativelyAsync, () => {
  it('sets the channel', async () => {
    const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
    fs.ensureDirSync(reactNativeProjectDirectory);
    const ctx = {
      reactNativeProjectDirectory,
      job: { updates: { channel } },
      logger: { info: () => {} },
    };

    fs.ensureDirSync(path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/'));
    fs.writeFileSync(
      path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/project.pbxproj'),
      Buffer.from('placeholder')
    );

    const expoPlistDirectory = await getExpoPlistDirectoryAsync(reactNativeProjectDirectory);
    const expoPlistPath = path.join(expoPlistDirectory, 'Expo.plist');

    fs.ensureDirSync(expoPlistDirectory);
    fs.writeFileSync(expoPlistPath, noItemsExpoPlist);

    await iosSetChannelNativelyAsync(ctx as any);

    const newExpoPlist = await fs.readFile(expoPlistPath, 'utf8');
    expect(
      plist.parse(newExpoPlist)[IosMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY]
    ).toEqual({ 'expo-channel-name': channel });
  });
});

describe(iosGetNativelyDefinedReleaseChannelAsync, () => {
  it('gets the natively defined release channel', async () => {
    const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
    fs.ensureDirSync(reactNativeProjectDirectory);
    const releaseChannel = 'default';
    const ctx = {
      reactNativeProjectDirectory,
      logger: { info: () => {} },
    };

    const releaseChannelInPlist = `
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
      <dict>
        <key>${IosMetadataName.RELEASE_CHANNEL}</key>
        <string>${releaseChannel}</string>
      </dict>
    </plist>`;

    fs.ensureDirSync(path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/'));
    fs.writeFileSync(
      path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/project.pbxproj'),
      Buffer.from('placeholder')
    );

    const expoPlistDirectory = await getExpoPlistDirectoryAsync(reactNativeProjectDirectory);
    const expoPlistPath = path.join(expoPlistDirectory, 'Expo.plist');

    fs.ensureDirSync(expoPlistDirectory);
    fs.writeFileSync(expoPlistPath, releaseChannelInPlist);

    const nativelyDefinedReleaseChannel = await iosGetNativelyDefinedReleaseChannelAsync(
      ctx as any
    );

    expect(nativelyDefinedReleaseChannel).toBe(releaseChannel);
  });
});
