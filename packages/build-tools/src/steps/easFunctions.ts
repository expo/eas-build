import { Job } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { BuildContext } from '../context';

import { createUploadArtifactBuildFunction } from './functions/uploadArtifact';
import { createCheckoutBuildFunction } from './functions/checkout';
import { createSetUpNpmrcBuildFunction } from './functions/setUpNpmrc';
import { createInstallNodeModulesBuildFunction } from './functions/installNodeModules';
import { createPrepareCredentialsBuildFunction } from './functions/prepareCredentials';
import { createCleanUpCredentialsBuildFunction } from './functions/cleanUpCredentials';

export function getEasFunctions<T extends Job>(ctx: BuildContext<T>): BuildFunction[] {
  return [
    createCheckoutBuildFunction(),
    createUploadArtifactBuildFunction(ctx),
    createSetUpNpmrcBuildFunction(ctx),
    createInstallNodeModulesBuildFunction(ctx),
    createPrepareCredentialsBuildFunction(ctx),
    createCleanUpCredentialsBuildFunction(ctx),
  ];
}
