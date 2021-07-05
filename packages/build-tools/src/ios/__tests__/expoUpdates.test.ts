import path from 'path';

import fs from 'fs-extra';
import plist from '@expo/plist';
import { IOSConfig } from '@expo/config-plugins';

import {
  iosGetNativelyDefinedClassicReleaseChannelAsync,
  IosMetadataName,
  iosSetChannelNativelyAsync,
  iosSetClassicReleaseChannelNativelyAsync,
  iosGetNativelyDefinedRuntimeVersionAsync,
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

describe(iosSetClassicReleaseChannelNativelyAsync, () => {
  test('sets the release channel', async () => {
    const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
    fs.ensureDirSync(reactNativeProjectDirectory);
    const releaseChannel = 'default';
    const ctx = {
      reactNativeProjectDirectory,
      job: { releaseChannel },
      logger: { info: () => {} },
    };

    fs.ensureDirSync(path.join(reactNativeProjectDirectory, '/ios/test/'));
    fs.writeFileSync(
      path.join(reactNativeProjectDirectory, '/ios/test/AppDelegate.m'),
      Buffer.from('placeholder')
    );

    const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);
    const expoPlistDirectory = path.dirname(expoPlistPath);

    fs.ensureDirSync(expoPlistDirectory);
    fs.writeFileSync(expoPlistPath, noItemsExpoPlist);

    await iosSetClassicReleaseChannelNativelyAsync(ctx as any);

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

    fs.ensureDirSync(path.join(reactNativeProjectDirectory, '/ios/test/'));
    fs.writeFileSync(
      path.join(reactNativeProjectDirectory, '/ios/test/AppDelegate.m'),
      Buffer.from('placeholder')
    );

    const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);
    const expoPlistDirectory = path.dirname(expoPlistPath);

    fs.ensureDirSync(expoPlistDirectory);
    fs.writeFileSync(expoPlistPath, noItemsExpoPlist);

    await iosSetChannelNativelyAsync(ctx as any);

    const newExpoPlist = await fs.readFile(expoPlistPath, 'utf8');
    expect(
      plist.parse(newExpoPlist)[IosMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY]
    ).toEqual({ 'expo-channel-name': channel });
  });
});

describe(iosGetNativelyDefinedClassicReleaseChannelAsync, () => {
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

    fs.ensureDirSync(path.join(reactNativeProjectDirectory, '/ios/test/'));
    fs.writeFileSync(
      path.join(reactNativeProjectDirectory, '/ios/test/AppDelegate.m'),
      Buffer.from('placeholder')
    );

    const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);
    const expoPlistDirectory = path.dirname(expoPlistPath);

    fs.ensureDirSync(expoPlistDirectory);
    fs.writeFileSync(expoPlistPath, releaseChannelInPlist);

    const nativelyDefinedReleaseChannel = await iosGetNativelyDefinedClassicReleaseChannelAsync(
      ctx as any
    );

    expect(nativelyDefinedReleaseChannel).toBe(releaseChannel);
  });
});

describe(iosGetNativelyDefinedRuntimeVersionAsync, () => {
  it('gets the natively defined runtime version', async () => {
    const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
    fs.ensureDirSync(reactNativeProjectDirectory);
    const runtimeVersion = '4.5.6';
    const ctx = {
      reactNativeProjectDirectory,
      logger: { info: () => {} },
    };

    const runtimeVersionInPlist = `
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
      <dict>
        <key>${IosMetadataName.RUNTIME_VERSION}</key>
        <string>${runtimeVersion}</string>
      </dict>
    </plist>`;

    fs.ensureDirSync(path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/'));
    fs.writeFileSync(
      path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/project.pbxproj'),
      Buffer.from('placeholder')
    );

    fs.ensureDirSync(path.join(reactNativeProjectDirectory, '/ios/test/'));
    fs.writeFileSync(
      path.join(reactNativeProjectDirectory, '/ios/test/AppDelegate.m'),
      Buffer.from('placeholder')
    );

    const expoPlistPath = IOSConfig.Paths.getExpoPlistPath(ctx.reactNativeProjectDirectory);
    const expoPlistDirectory = path.dirname(expoPlistPath);

    fs.ensureDirSync(expoPlistDirectory);
    fs.writeFileSync(expoPlistPath, runtimeVersionInPlist);

    const nativelyDefinedRuntimeVersion = await iosGetNativelyDefinedRuntimeVersionAsync(
      ctx as any
    );

    expect(nativelyDefinedRuntimeVersion).toBe(runtimeVersion);
  });
});
