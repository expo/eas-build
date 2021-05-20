import path from 'path';

import * as xml from 'xml2js';
import fs from 'fs-extra';

export enum AndroidMetadataName {
  UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY = 'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',
  RELEASE_CHANNEL = 'expo.modules.updates.EXPO_RELEASE_CHANNEL',
}

export async function setAndroidMetadataEntryAsync({
  reactNativeProjectDirectory,
  androidMetadataValue,
  androidMetadataName,
}: {
  reactNativeProjectDirectory: string;
  androidMetadataValue: string;
  androidMetadataName: AndroidMetadataName;
}): Promise<void> {
  const manifestPath = path.join(
    reactNativeProjectDirectory,
    'android',
    'app',
    'src',
    'main',
    'AndroidManifest.xml'
  );

  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(`Couldn't find Android manifest at ${manifestPath}`);
  }

  const manifestContent = await fs.readFile(manifestPath, 'utf8');
  const manifest = await xml.parseStringPromise(manifestContent);

  const mainApplication = manifest?.manifest?.application?.find(
    (e: any) => e?.['$']?.['android:name'] === '.MainApplication'
  );

  if (!mainApplication) {
    throw new Error(`Couldn't find '.MainApplication' in the manifest at ${manifestPath}`);
  }

  const newItem = {
    $: {
      'android:name': androidMetadataName,
      'android:value': androidMetadataValue,
    },
  };

  if (mainApplication['meta-data']) {
    const existingMetaDataItem = mainApplication['meta-data'].find(
      (e: any) => e.$['android:name'] === androidMetadataName
    );

    if (existingMetaDataItem) {
      existingMetaDataItem.$['android:value'] = androidMetadataValue;
    } else {
      mainApplication['meta-data'].push(newItem);
    }
  } else {
    mainApplication['meta-data'] = [newItem];
  }

  const manifestXml = new xml.Builder().buildObject(manifest);
  await fs.writeFile(manifestPath, manifestXml);
}

export async function getAndroidMetadataEntryAsync({
  reactNativeProjectDirectory,
  androidMetadataName,
}: {
  reactNativeProjectDirectory: string;
  androidMetadataName: AndroidMetadataName;
}): Promise<string | undefined> {
  const manifestPath = path.join(
    reactNativeProjectDirectory,
    'android',
    'app',
    'src',
    'main',
    'AndroidManifest.xml'
  );

  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(`Couldn't find Android manifest at ${manifestPath}`);
  }

  const manifestContent = await fs.readFile(manifestPath, 'utf8');
  const manifest = await xml.parseStringPromise(manifestContent);

  const mainApplication = manifest?.manifest?.application?.find(
    (e: any) => e?.['$']?.['android:name'] === '.MainApplication'
  );

  if (!mainApplication?.['meta-data']) {
    return;
  }
  const existingMetaDataItem = mainApplication['meta-data'].find(
    (e: any) => e.$['android:name'] === androidMetadataName
  );
  return existingMetaDataItem?.$?.['android:value'];
}
