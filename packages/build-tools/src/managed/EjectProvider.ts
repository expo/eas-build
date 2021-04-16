import { Job } from '@expo/eas-build-job';

import { BuildContext } from '../context';

interface EjectProvider<TJob extends Job> {
  runEject(ctx: BuildContext<TJob>): Promise<void>;
}

export { EjectProvider };
