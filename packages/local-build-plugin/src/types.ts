import { Metadata } from '@expo/eas-build-job';

export interface BuildParams {
  workingdir: string;
  env: Record<string, string>;
  metadata: Metadata;
}
