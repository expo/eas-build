import { Job } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { BuildContext } from '../context';

import { createUploadArtifactStepsFunction } from './functions/uploadArtifact';

export function getEasFunctions<T extends Job>(ctx: BuildContext<T>): BuildFunction[] {
  return [createUploadArtifactStepsFunction(ctx)];
}
