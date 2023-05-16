import { Job } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { BuildContext } from '../context';

import { createUploadArtifactBuildFunction } from './functions/uploadArtifact';
import { createCheckoutBuildFunction } from './functions/checkout';

export function getEasFunctions<T extends Job>(ctx: BuildContext<T>): BuildFunction[] {
  return [createCheckoutBuildFunction(), createUploadArtifactBuildFunction(ctx)];
}
