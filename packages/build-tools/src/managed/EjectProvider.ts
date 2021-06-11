import { Job } from '@expo/eas-build-job';

import { BuildContext } from '../context';

export interface EjectOptions {
  extraEnvs?: Record<string, string>;
}

export interface EjectProvider<TJob extends Job> {
  runEject(ctx: BuildContext<TJob>, options?: EjectOptions): Promise<void>;
}
