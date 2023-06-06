import { Job } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { BuildContext } from '../context';

import { createUploadArtifactBuildFunction } from './functions/uploadArtifact';
import { createCheckoutBuildFunction } from './functions/checkout';
import { createSetUpNpmrcBuildFunction } from './functions/setUpNpmrc';
import { createInstallNodeModulesBuildFunction } from './functions/installNodeModules';
import { createRunGradleBuildFunction } from './functions/runGradle';
import { createPrebuildBuildFunction } from './functions/prebuild';

export function getEasFunctions<T extends Job>(ctx: BuildContext<T>): BuildFunction[] {
  return [
    createCheckoutBuildFunction(),
    createUploadArtifactBuildFunction(ctx),
    createSetUpNpmrcBuildFunction(ctx),
    createInstallNodeModulesBuildFunction(ctx),
    createPrebuildBuildFunction(ctx),
    createRunGradleBuildFunction(ctx),
  ];
}
