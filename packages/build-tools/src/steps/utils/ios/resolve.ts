import assert from 'assert';

import { Ios } from '@expo/eas-build-job';
import { IOSConfig } from '@expo/config-plugins';

export function resolveScheme(job: Ios.Job, { workingDir }: { workingDir: string }): string {
  if (job.scheme) {
    return job.scheme;
  }
  const schemes = IOSConfig.BuildScheme.getSchemesFromXcodeproj(workingDir);
  assert(schemes.length === 1, 'Ejected project should have exactly one scheme');
  return schemes[0];
}

export function resolveBuildConfiguration(job: Ios.Job): string {
  if (job.buildConfiguration) {
    return job.buildConfiguration;
  } else if (job.developmentClient) {
    return 'Debug';
  } else {
    return 'Release';
  }
}
