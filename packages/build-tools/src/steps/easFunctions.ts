import { Job } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { BuildContext } from '../context';
import { CustomBuildContext } from '../customBuildContext';

import { createUploadArtifactBuildFunction } from './functions/utils/uploadArtifact';
import { createCheckoutBuildFunction } from './functions/eas/checkout';
import { createSetUpNpmrcBuildFunction } from './functions/eas/setUpNpmrc';
import { createInstallNodeModulesBuildFunction } from './functions/eas/installNodeModules';
import { createPrebuildBuildFunction } from './functions/eas/prebuild';
import { createBuildReactNativeAppBuildFunction } from './functions/eas/buildReactNativeApp';
import { createFindAndUploadBuildArtifactsBuildFunction } from './functions/eas/findAndUploadBuildArtifacts';
import { configureEASUpdateIfInstalledFunction } from './functions/eas/configureEASUpdateIfInstalled';
import { injectAndroidCredentialsFunction } from './functions/utils/injectAndroidCredentials';
import { configureAndroidVersionFunction } from './functions/utils/configureAndroidVersion';
import { runGradleFunction } from './functions/utils/runGradle';
import { resolveAppleTeamIdFromCredentialsFunction } from './functions/utils/resolveAppleTeamIdFromCredentials';
import { configureIosCredentialsFunction } from './functions/utils/configureIosCredentials';
import { configureIosVersionFunction } from './functions/utils/configureIosVersion';

export function getEasFunctions(
  ctx: CustomBuildContext,
  oldCtx: BuildContext<Job> // TODO: remove
): BuildFunction[] {
  return [
    createCheckoutBuildFunction(),
    createUploadArtifactBuildFunction(ctx),
    createSetUpNpmrcBuildFunction(ctx),
    createInstallNodeModulesBuildFunction(ctx),
    createPrebuildBuildFunction(ctx),
    createBuildReactNativeAppBuildFunction(oldCtx),
    createFindAndUploadBuildArtifactsBuildFunction(ctx),
    configureEASUpdateIfInstalledFunction(),
    injectAndroidCredentialsFunction(),
    configureAndroidVersionFunction(),
    runGradleFunction(),
    resolveAppleTeamIdFromCredentialsFunction(),
    configureIosCredentialsFunction(),
    configureIosVersionFunction(),
  ];
}
