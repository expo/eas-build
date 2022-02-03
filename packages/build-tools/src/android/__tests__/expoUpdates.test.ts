import path from 'path';

import fs from 'fs-extra';
import { AndroidConfig } from '@expo/config-plugins';

import {
  AndroidMetadataName,
  androidGetNativelyDefinedClassicReleaseChannelAsync,
  androidSetChannelNativelyAsync,
  androidSetClassicReleaseChannelNativelyAsync,
  androidGetNativelyDefinedRuntimeVersionAsync,
} from '../expoUpdates';

jest.mock('fs');

const channel = 'main';
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
describe(androidSetClassicReleaseChannelNativelyAsync, () => {
  test('sets the release channel', async () => {
    const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
    fs.ensureDirSync(reactNativeProjectDirectory);
    const releaseChannel = 'default';
    const ctx = {
      reactNativeProjectDirectory,
      job: { releaseChannel },
      logger: { info: () => {} },
    };

    fs.ensureDirSync(path.join(reactNativeProjectDirectory, 'android'));
    const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
      reactNativeProjectDirectory
    );
    const manifestDirectory = path.dirname(manifestPath);

    fs.ensureDirSync(manifestDirectory);
    fs.writeFileSync(manifestPath, Buffer.from(noMetadataAndroidManifest));
    const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    expect(
      AndroidConfig.Manifest.getMainApplicationMetaDataValue(androidManifest, 'releaseChannel')
    ).toBe(null);

    await androidSetClassicReleaseChannelNativelyAsync(ctx as any);

    const newAndroidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    expect(
      AndroidConfig.Manifest.getMainApplicationMetaDataValue(
        newAndroidManifest,
        AndroidMetadataName.RELEASE_CHANNEL
      )
    ).toBe(releaseChannel);
  });
});
describe(androidSetChannelNativelyAsync, () => {
  it('sets the channel', async () => {
    const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
    fs.ensureDirSync(reactNativeProjectDirectory);
    const ctx = {
      reactNativeProjectDirectory,
      job: { updates: { channel } },
      logger: { info: () => {} },
    };

    fs.ensureDirSync(path.join(reactNativeProjectDirectory, 'android'));
    const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
      reactNativeProjectDirectory
    );
    const manifestDirectory = path.dirname(manifestPath);

    fs.ensureDirSync(manifestDirectory);
    fs.writeFileSync(manifestPath, noMetadataAndroidManifest);

    const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    expect(
      AndroidConfig.Manifest.getMainApplicationMetaDataValue(
        androidManifest,
        AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY
      )
    ).toBe(null);

    await androidSetChannelNativelyAsync(ctx as any);

    const newAndroidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    const newValue = AndroidConfig.Manifest.getMainApplicationMetaDataValue(
      newAndroidManifest,
      AndroidMetadataName.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY
    );
    expect(newValue).toBeDefined();
    expect(newValue).toEqual(JSON.stringify({ 'expo-channel-name': channel }).replace(/"/g, "'"));
  });
});
describe(androidGetNativelyDefinedClassicReleaseChannelAsync, () => {
  it('gets the natively defined release channel', async () => {
    const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
    fs.ensureDirSync(reactNativeProjectDirectory);
    const releaseChannel = 'default';
    const ctx = {
      reactNativeProjectDirectory,
      logger: { info: () => {} },
    };

    const releaseChannelInAndroidManifest = `
    <manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.expo.mycoolapp">
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
    fs.ensureDirSync(path.join(reactNativeProjectDirectory, 'android'));
    const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
      reactNativeProjectDirectory
    );
    const manifestDirectory = path.dirname(manifestPath);

    fs.ensureDirSync(manifestDirectory);
    fs.writeFileSync(manifestPath, releaseChannelInAndroidManifest);

    const nativelyDefinedReleaseChannel = await androidGetNativelyDefinedClassicReleaseChannelAsync(
      ctx as any
    );
    expect(nativelyDefinedReleaseChannel).toBe(releaseChannel);
  });
});
describe(androidGetNativelyDefinedRuntimeVersionAsync, () => {
  it('gets the native runtime version', async () => {
    const reactNativeProjectDirectory = fs.mkdtempSync('/expo-project-');
    fs.ensureDirSync(reactNativeProjectDirectory);
    const runtimeVersion = 'default';
    const ctx = {
      reactNativeProjectDirectory,
      logger: { info: () => {} },
    };

    const runtimeVersionInAndroidManifest = `
    <manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.expo.mycoolapp">
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
      <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="${runtimeVersion}"/>
    </application>
    </manifest>`;
    fs.ensureDirSync(path.join(reactNativeProjectDirectory, 'android'));
    const manifestPath = await AndroidConfig.Paths.getAndroidManifestAsync(
      reactNativeProjectDirectory
    );
    const manifestDirectory = path.dirname(manifestPath);

    fs.ensureDirSync(manifestDirectory);
    fs.writeFileSync(manifestPath, runtimeVersionInAndroidManifest);

    const nativelyDefinedRuntimeVersion = await androidGetNativelyDefinedRuntimeVersionAsync(
      ctx as any
    );
    expect(nativelyDefinedRuntimeVersion).toBe(runtimeVersion);
  });
});
