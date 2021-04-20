import path from 'path';

import * as xml from 'xml2js';
import fs from 'fs-extra';

const RELEASE_CHANNEL = 'expo.modules.updates.EXPO_RELEASE_CHANNEL';

async function updateReleaseChannel(
  reactNativeProjectDirectory: string,
  releaseChannel: string
): Promise<void> {
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
      'android:name': RELEASE_CHANNEL,
      'android:value': releaseChannel,
    },
  };

  if (mainApplication['meta-data']) {
    const existingMetaDataItem = mainApplication['meta-data'].find(
      (e: any) => e.$['android:name'] === RELEASE_CHANNEL
    );

    if (existingMetaDataItem) {
      existingMetaDataItem.$['android:value'] = releaseChannel;
    } else {
      mainApplication['meta-data'].push(newItem);
    }
  } else {
    mainApplication['meta-data'] = [newItem];
  }

  const manifestXml = new xml.Builder().buildObject(manifest);
  await fs.writeFile(manifestPath, manifestXml);
}

async function getReleaseChannel(reactNativeProjectDirectory: string): Promise<string | undefined> {
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
    (e: any) => e.$['android:name'] === RELEASE_CHANNEL
  );
  return existingMetaDataItem?.$?.['android:value'];
}

export { getReleaseChannel, updateReleaseChannel };
