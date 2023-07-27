import { Job } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { BuildContext } from '../context';
import { CustomBuildContext } from '../customBuildContext';

import { createUploadArtifactBuildFunction } from './functions/utils/uploadArtifact';
import { createCheckoutBuildFunction } from './functions/eas/checkout';
import { createSetUpNpmrcBuildFunction } from './functions/eas/setUpNpmrc';
import { createInstallNodeModulesBuildFunction } from './functions/eas/installNodeModules';
import { createRunGradleBuildFunction } from './functions/utils/runGradle';
import { createPrebuildBuildFunction } from './functions/eas/prebuild';
import { createBuildReactNativeAppBuildFunction } from './functions/eas/buildReactNativeApp';
import { createFindAndUploadBuildArtifactsBuildFunction } from './functions/eas/findAndUploadBuildArtifacts';
import { configureExpoUpdatesIfInstalledFunction } from './functions/eas/configureExpoUpdatesIfInstalled';

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
    createRunGradleBuildFunction(oldCtx),
    createBuildReactNativeAppBuildFunction(oldCtx),
    createFindAndUploadBuildArtifactsBuildFunction(ctx),
    configureExpoUpdatesIfInstalledFunction(),
  ];
}
