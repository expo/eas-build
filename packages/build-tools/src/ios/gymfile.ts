import path from 'path';

import templateFile from '@expo/template-file';
import fs from 'fs-extra';

import { Credentials } from './credentials/manager';

const ARCHIVE_TEMPLATE_FILE_PATH = path.join(__dirname, '../../templates/Gymfile.archive.template');
const SIMULATOR_TEMPLATE_FILE_PATH = path.join(
  __dirname,
  '../../templates/Gymfile.simulator.template'
);

interface ArchiveBuildOptions {
  outputFile: string;
  credentials: Credentials;
  scheme: string;
  buildConfiguration?: string;
  outputDirectory: string;
  clean: boolean;
  logsDirectory: string;
  entitlements?: object;
}

interface SimulatorBuildOptions {
  outputFile: string;
  scheme: string;
  buildConfiguration?: string;
  derivedDataPath: string;
  clean: boolean;
  logsDirectory: string;
  simulatorDestination: string;
}

export async function createGymfileForArchiveBuild({
  outputFile,
  clean,
  credentials,
  scheme,
  buildConfiguration,
  entitlements,
  outputDirectory,
  logsDirectory,
}: ArchiveBuildOptions): Promise<void> {
  const PROFILES: { BUNDLE_ID: string; UUID: string }[] = [];
  const targets = Object.keys(credentials.targetProvisioningProfiles);
  for (const target of targets) {
    const profile = credentials.targetProvisioningProfiles[target];
    PROFILES.push({
      BUNDLE_ID: profile.bundleIdentifier,
      UUID: profile.uuid,
    });
  }

  const ICLOUD_CONTAINER_ENVIRONMENT = (entitlements as Record<
    string,
    string | Record<string, string>
  >)?.['com.apple.developer.icloud-container-environment'] as string | undefined;

  await fs.mkdirp(logsDirectory);
  await createGymfile({
    template: ARCHIVE_TEMPLATE_FILE_PATH,
    outputFile,
    vars: {
      KEYCHAIN_PATH: credentials.keychainPath,
      SCHEME: scheme,
      SCHEME_BUILD_CONFIGURATION: buildConfiguration,
      OUTPUT_DIRECTORY: outputDirectory,
      EXPORT_METHOD: credentials.distributionType,
      CLEAN: String(clean),
      LOGS_DIRECTORY: logsDirectory,
      PROFILES,
      ICLOUD_CONTAINER_ENVIRONMENT,
    },
  });
}

export async function createGymfileForSimulatorBuild({
  outputFile,
  clean,
  scheme,
  buildConfiguration,
  derivedDataPath,
  logsDirectory,
  simulatorDestination,
}: SimulatorBuildOptions): Promise<void> {
  await fs.mkdirp(logsDirectory);
  await createGymfile({
    template: SIMULATOR_TEMPLATE_FILE_PATH,
    outputFile,
    vars: {
      SCHEME: scheme,
      SCHEME_BUILD_CONFIGURATION: buildConfiguration,
      SCHEME_SIMULATOR_DESTINATION: simulatorDestination,
      DERIVED_DATA_PATH: derivedDataPath,
      CLEAN: String(clean),
      LOGS_DIRECTORY: logsDirectory,
    },
  });
}

async function createGymfile({
  template,
  outputFile,
  vars,
}: {
  template: string;
  outputFile: string;
  vars: Record<string, string | number | any>;
}): Promise<void> {
  await templateFile(template, vars, outputFile, { mustache: false });
}
