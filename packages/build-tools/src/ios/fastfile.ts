import path from 'path';

import templateFile from '@expo/template-file';

import { TargetProvisioningProfiles } from './credentials/manager';

const RESIGN_TEMPLATE_FILE_PATH = path.join(__dirname, '../../templates/Fastfile.resign.template');

export async function createFastfileForResigningBuild({
  outputFile,
  ipaPath,
  signingIdentity,
  keychainPath,
  targetProvisioningProfiles,
}: {
  outputFile: string;
  ipaPath: string;
  signingIdentity: string;
  keychainPath: string;
  targetProvisioningProfiles: TargetProvisioningProfiles;
}): Promise<void> {
  const PROFILES: { BUNDLE_ID: string; PATH: string }[] = [];
  const targets = Object.keys(targetProvisioningProfiles);
  for (const target of targets) {
    const profile = targetProvisioningProfiles[target];
    PROFILES.push({
      BUNDLE_ID: profile.bundleIdentifier,
      PATH: profile.path,
    });
  }

  await templateFile(
    RESIGN_TEMPLATE_FILE_PATH,
    {
      IPA_PATH: ipaPath,
      SIGNING_IDENTITY: signingIdentity,
      PROFILES,
      KEYCHAIN_PATH: keychainPath,
    },
    outputFile,
    { mustache: false },
  );
}
