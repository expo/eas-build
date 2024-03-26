import { Env } from './common';
import { Metadata } from './metadata';

import { Job } from './index';

export type BuildStaticContext = {
  job: Job;
  metadata: Metadata | null;
  env: Env;
};
