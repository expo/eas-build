import path from 'path';

import { vol } from 'memfs';
import fs from 'fs-extra';
import { Platform } from '@expo/eas-build-job';
import { AndroidConfig } from '@expo/config-plugins';
import plist from '@expo/plist';

import { ManagedBuildContext, ManagedJob } from '../../managed/context';
import * as expoUpdates from '../expoUpdates';
import isExpoUpdatesInstalledAsync from '../isExpoUpdatesInstalled';
import { AndroidMetadataName } from '../../android/expoUpdates';
import { getExpoPlistDirectoryAsync, IosMetadataName } from '../../ios/expoUpdates';

jest.mock('../isExpoUpdatesInstalled', () => jest.fn());
jest.mock('fs');
const noMetadataAndroidManifest = `
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
  package="com.expo.mycoolapp">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
      android:name=".MainApplication"
      android:label="@string/app_name"
      android:icon="@mipmap/ic_launcher"
      android:roundIcon="@mipmap/ic_launcher_round"
      android:allowBackup="true"
      android:theme="@style/AppTheme">
      <activity
        android:name=".MainActivity"
        android:launchMode="singleTask"
        android:label="@string/app_name"
        android:configChanges="keyboard|keyboardHidden|orientation|screenSize"
        android:windowSoftInputMode="adjustResize">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
      </activity>
      <activity android:name="com.facebook.react.devsupport.DevSettingsActivity" />
    </application>

</manifest>
`;
const noItemsExpoPlist = `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
      <dict>
      </dict>
    </plist>`;

const channel = 'main';

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

describe(expoUpdates.setReleaseChannelNativelyAsync, () => {
  beforeAll(() => {
    jest.restoreAllMocks();
  });
  beforeEach(async () => {
    vol.reset();
  });
  const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
  fs.ensureDirSync(reactNativeProjectDirectory);
  const releaseChannel = 'default';
  const ctx = {
    reactNativeProjectDirectory,
    job: { releaseChannel },
    logger: { info: () => {} },
  };

  test(Platform.ANDROID, async () => {
    const manifestDirectory = expoUpdates.getAndroidManifestDirectory(reactNativeProjectDirectory);
    const manifestPath = path.join(manifestDirectory, 'AndroidManifest.xml');

    fs.ensureDirSync(manifestDirectory);
    fs.writeFileSync(manifestPath, Buffer.from(noMetadataAndroidManifest));
    const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    expect(
      AndroidConfig.Manifest.getMainApplicationMetaDataValue(androidManifest, 'releaseChannel')
    ).toBe(null);

    await expoUpdates.setReleaseChannelNativelyAsync(ctx as any, Platform.ANDROID);

    const newAndroidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    expect(
      AndroidConfig.Manifest.getMainApplicationMetaDataValue(
        newAndroidManifest,
        AndroidMetadataName.RELEASE_CHANNEL
      )
    ).toBe(releaseChannel);
  });
  test(Platform.IOS, async () => {
    fs.ensureDirSync(path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/'));
    fs.writeFileSync(
      path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/project.pbxproj'),
      Buffer.from('placeholder')
    );

    const expoPlistDirectory = await getExpoPlistDirectoryAsync(reactNativeProjectDirectory);
    const expoPlistPath = path.join(expoPlistDirectory, 'Expo.plist');

    fs.ensureDirSync(expoPlistDirectory);
    fs.writeFileSync(expoPlistPath, noItemsExpoPlist);

    await expoUpdates.setReleaseChannelNativelyAsync(ctx as any, Platform.IOS);

    const newExpoPlist = await fs.readFile(expoPlistPath, 'utf8');
    expect(plist.parse(newExpoPlist)[IosMetadataName.RELEASE_CHANNEL]).toEqual(releaseChannel);
  });
});

describe(expoUpdates.setChannelNativelyAsync, () => {
  beforeAll(() => {
    jest.restoreAllMocks();
  });
  beforeEach(async () => {
    vol.reset();
  });
  const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
  fs.ensureDirSync(reactNativeProjectDirectory);
  const ctx = {
    reactNativeProjectDirectory,
    job: { updates: { channel } },
    logger: { info: () => {} },
  };
  it(Platform.ANDROID, async () => {
    const manifestDirectory = expoUpdates.getAndroidManifestDirectory(reactNativeProjectDirectory);
    const manifestPath = path.join(manifestDirectory, 'AndroidManifest.xml');

    fs.ensureDirSync(manifestDirectory);
    fs.writeFileSync(manifestPath, noMetadataAndroidManifest);

    const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    expect(
      AndroidConfig.Manifest.getMainApplicationMetaDataValue(
        androidManifest,
        AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY
      )
    ).toBe(null);

    await expoUpdates.setChannelNativelyAsync(ctx as any, Platform.ANDROID);

    const newAndroidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    const newValue = AndroidConfig.Manifest.getMainApplicationMetaDataValue(
      newAndroidManifest,
      AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY
    );
    expect(newValue).toBeDefined();
    expect(JSON.parse(newValue!)).toEqual({ 'expo-channel-name': channel });
  });
  it(Platform.IOS, async () => {
    fs.ensureDirSync(path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/'));
    fs.writeFileSync(
      path.join(reactNativeProjectDirectory, '/ios/Pods.xcodeproj/project.pbxproj'),
      Buffer.from('placeholder')
    );

    const expoPlistDirectory = await getExpoPlistDirectoryAsync(reactNativeProjectDirectory);
    const expoPlistPath = path.join(expoPlistDirectory, 'Expo.plist');

    fs.ensureDirSync(expoPlistDirectory);
    fs.writeFileSync(expoPlistPath, noItemsExpoPlist);

    await expoUpdates.setChannelNativelyAsync(ctx as any, Platform.IOS);

    const newExpoPlist = await fs.readFile(expoPlistPath, 'utf8');
    expect(
      plist.parse(newExpoPlist)[IosMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY]
    ).toEqual({ 'expo-channel-name': channel });
  });
});

describe(expoUpdates.getNativelyDefinedReleaseChannelAsync, () => {
  beforeAll(() => {
    jest.restoreAllMocks();
  });
  const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
  fs.ensureDirSync(reactNativeProjectDirectory);
  const releaseChannel = 'default';
  const ctx = {
    reactNativeProjectDirectory,
    logger: { info: () => {} },
  };
  beforeEach(async () => {
    vol.reset();
  });
  it(Platform.ANDROID, async () => {
    const AndroidManifest = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.expo.mycoolapp">
<uses-permission android:name="android.permission.INTERNET"/>
<application android:name=".MainApplication" android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" android:allowBackup="true" android:theme="@style/AppTheme">
  <activity android:name=".MainActivity" android:launchMode="singleTask" android:label="@string/app_name" android:configChanges="keyboard|keyboardHidden|orientation|screenSize" android:windowSoftInputMode="adjustResize">
    <intent-filter>
      <action android:name="android.intent.action.MAIN"/>
      <category android:name="android.intent.category.LAUNCHER"/>
    </intent-filter>
  </activity>
  <activity android:name="com.facebook.react.devsupport.DevSettingsActivity"/>
  <meta-data android:name="expo.modules.updates.EXPO_RELEASE_CHANNEL" android:value="default"/>
</application>
</manifest>`;
    const manifestDirectory = expoUpdates.getAndroidManifestDirectory(reactNativeProjectDirectory);
    const manifestPath = path.join(manifestDirectory, 'AndroidManifest.xml');

    fs.ensureDirSync(manifestDirectory);
    fs.writeFileSync(manifestPath, AndroidManifest);

    const nativelyDefinedReleaseChannel = await expoUpdates.getNativelyDefinedReleaseChannelAsync(
      ctx as any,
      Platform.ANDROID
    );
    expect(nativelyDefinedReleaseChannel).toBe(releaseChannel);
  });
  it(Platform.IOS, async () => {
    const ExpoPlist = `<?xml version="1.0" encoding="UTF-8"?>
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
    fs.writeFileSync(expoPlistPath, ExpoPlist);

    const nativelyDefinedReleaseChannel = await expoUpdates.getNativelyDefinedReleaseChannelAsync(
      ctx as any,
      Platform.IOS
    );

    expect(nativelyDefinedReleaseChannel).toBe(releaseChannel);
  });
});
