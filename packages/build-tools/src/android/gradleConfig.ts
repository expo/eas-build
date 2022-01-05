import path from 'path';

import { AndroidConfig } from '@expo/config-plugins';
import { Android } from '@expo/eas-build-job';
import fs from 'fs-extra';

import { BuildContext } from '../context';

const EAS_BUILD_GRADLE_TEMPLATE_PATH = path.join(__dirname, '../../templates/eas-build.gradle');
const APPLY_EAS_BUILD_GRADLE_LINE = 'apply from: "./eas-build.gradle"';

export async function configureBuildGradle(ctx: BuildContext<Android.Job>): Promise<void> {
  ctx.logger.info('Injecting signing config into build.gradle');
  await deleteEasBuildGradle(ctx.reactNativeProjectDirectory);
  await createEasBuildGradle(ctx.reactNativeProjectDirectory);
  await addApplyToBuildGradle(ctx.reactNativeProjectDirectory);
}

async function deleteEasBuildGradle(projectRoot: string): Promise<void> {
  const easBuildGradlePath = getEasBuildGradlePath(projectRoot);
  await fs.remove(easBuildGradlePath);
}

function getEasBuildGradlePath(projectRoot: string): string {
  return path.join(projectRoot, 'android/app/eas-build.gradle');
}

async function createEasBuildGradle(projectRoot: string): Promise<void> {
  const easBuildGradlePath = getEasBuildGradlePath(projectRoot);
  await fs.copy(EAS_BUILD_GRADLE_TEMPLATE_PATH, easBuildGradlePath);
}

async function addApplyToBuildGradle(projectRoot: string): Promise<void> {
  const buildGradlePath = AndroidConfig.Paths.getAppBuildGradleFilePath(projectRoot);
  const buildGradleContents = await fs.readFile(path.join(buildGradlePath), 'utf8');

  if (hasLine(buildGradleContents, APPLY_EAS_BUILD_GRADLE_LINE)) {
    return;
  }

  await fs.writeFile(
    buildGradlePath,
    `${buildGradleContents.trim()}\n${APPLY_EAS_BUILD_GRADLE_LINE}\n`
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
