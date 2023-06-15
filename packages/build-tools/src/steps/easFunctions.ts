import { Job } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { BuildContext } from '../context';

import { createUploadArtifactBuildFunction } from './functions/utils/uploadArtifact';
import { createCheckoutBuildFunction } from './functions/eas/checkout';
import { createSetUpNpmrcBuildFunction } from './functions/eas/setUpNpmrc';
import { createInstallNodeModulesBuildFunction } from './functions/eas/installNodeModules';
import { createRunGradleBuildFunction } from './functions/utils/runGradle';
import { createPrebuildBuildFunction } from './functions/eas/prebuild';
import { createBuildReactNativeAppBuildFunction } from './functions/eas/buildReactNativeApp';
import { createFindAndUploadApplicationArchiveBuildFunction } from './functions/eas/findAndUploadApplicationArchive';

export function getEasFunctions<T extends Job>(ctx: BuildContext<T>): BuildFunction[] {
  return [
    createCheckoutBuildFunction(),
    createUploadArtifactBuildFunction(ctx),
    createSetUpNpmrcBuildFunction(ctx),
    createInstallNodeModulesBuildFunction(ctx),
    createPrebuildBuildFunction(ctx),
    createRunGradleBuildFunction(ctx),
    createBuildReactNativeAppBuildFunction(ctx),
    createFindAndUploadApplicationArchiveBuildFunction(ctx),
  ];
}
