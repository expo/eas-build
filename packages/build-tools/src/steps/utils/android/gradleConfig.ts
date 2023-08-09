import path from 'path';

import { AndroidConfig } from '@expo/config-plugins';
import { bunyan } from '@expo/logger';
import fs from 'fs-extra';
import templateFile from '@expo/template-file';

const EAS_BUILD_INJECT_CREDENTIALS_GRADLE_TEMPLATE_PATH = path.join(
  __dirname,
  '../../../../templates/eas-build-inject-android-credentials.gradle'
);
const EAS_BUILD_CONFIGURE_VERSION_GRADLE_TEMPLATE_PATH = path.join(
  __dirname,
  '../../../../templates/eas-build-configure-version.gradle.template'
);

const APPLY_EAS_BUILD_INJECT_CREDENTIALS_GRADLE_LINE =
  'apply from: "./eas-build-inject-android-credentials.gradle"';
const APPLY_EAS_BUILD_CONFIGURE_VERSION_GRADLE_LINE =
  'apply from: "./eas-build-configure-version.gradle"';

export async function injectCredentialsGradleConfig(
  logger: bunyan,
  workingDir: string
): Promise<void> {
  logger.info('Injecting signing config into build.gradle');
  await deleteEasBuildInjectCredentialsGradle(workingDir);
  await createEasBuildInjectCredentialsGradle(workingDir);
  await addApplyInjectCredentialsConfigToBuildGradle(workingDir);
  logger.info('Signing config injected');
}

export async function injectConfigureVersionGradleConfig(
  logger: bunyan,
  workingDir: string,
  { versionCode, versionName }: { versionCode?: string; versionName?: string }
): Promise<void> {
  logger.info('Injecting version config into build.gradle');
  logger.info(`Version code: ${versionCode}`);
  logger.info(`Version name: ${versionName}`);
  await deleteEasBuildConfigureVersionGradle(workingDir);
  await createEasBuildConfigureVersionGradle(workingDir, { versionCode, versionName });
  await addApplyConfigureVersionConfigToBuildGradle(workingDir);
  logger.info('Version config injected');
}

async function deleteEasBuildInjectCredentialsGradle(workingDir: string): Promise<void> {
  const targetPath = getEasBuildInjectCredentialsGradlePath(workingDir);
  await fs.remove(targetPath);
}

async function deleteEasBuildConfigureVersionGradle(workingDir: string): Promise<void> {
  const targetPath = getEasBuildConfigureVersionGradlePath(workingDir);
  await fs.remove(targetPath);
}

function getEasBuildInjectCredentialsGradlePath(workingDir: string): string {
  return path.join(workingDir, 'android/app/eas-build-inject-android-credentials.gradle');
}

function getEasBuildConfigureVersionGradlePath(workingDir: string): string {
  return path.join(workingDir, 'android/app/eas-build-configure-version.gradle');
}

async function createEasBuildInjectCredentialsGradle(workingDir: string): Promise<void> {
  const targetPath = getEasBuildInjectCredentialsGradlePath(workingDir);
  await fs.copy(EAS_BUILD_INJECT_CREDENTIALS_GRADLE_TEMPLATE_PATH, targetPath);
}

async function createEasBuildConfigureVersionGradle(
  workingDir: string,
  { versionCode, versionName }: { versionCode?: string; versionName?: string }
): Promise<void> {
  const targetPath = getEasBuildConfigureVersionGradlePath(workingDir);
  await templateFile(
    EAS_BUILD_CONFIGURE_VERSION_GRADLE_TEMPLATE_PATH,
    {
      VERSION_CODE: versionCode,
      VERSION_NAME: versionName,
    },
    targetPath,
    {
      mustache: false,
    }
  );
}

async function addApplyInjectCredentialsConfigToBuildGradle(projectRoot: string): Promise<void> {
  const buildGradlePath = AndroidConfig.Paths.getAppBuildGradleFilePath(projectRoot);
  const buildGradleContents = await fs.readFile(path.join(buildGradlePath), 'utf8');

  if (hasLine(buildGradleContents, APPLY_EAS_BUILD_INJECT_CREDENTIALS_GRADLE_LINE)) {
    return;
  }

  await fs.writeFile(
    buildGradlePath,
    `${buildGradleContents.trim()}\n${APPLY_EAS_BUILD_INJECT_CREDENTIALS_GRADLE_LINE}\n`
  );
}

async function addApplyConfigureVersionConfigToBuildGradle(projectRoot: string): Promise<void> {
  const buildGradlePath = AndroidConfig.Paths.getAppBuildGradleFilePath(projectRoot);
  const buildGradleContents = await fs.readFile(path.join(buildGradlePath), 'utf8');

  if (hasLine(buildGradleContents, APPLY_EAS_BUILD_CONFIGURE_VERSION_GRADLE_LINE)) {
    return;
  }

  await fs.writeFile(
    buildGradlePath,
    `${buildGradleContents.trim()}\n${APPLY_EAS_BUILD_CONFIGURE_VERSION_GRADLE_LINE}\n`
  );
}

function hasLine(haystack: string, needle: string): boolean {
  return (
    haystack
      .replace(/\r\n/g, '\n')
      .split('\n')
      // Check for both single and double quotes
      .some((line) => line === needle || line === needle.replace(/"/g, "'"))
  );
}
