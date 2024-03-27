import { Env } from './common';
import { Job } from './job';
import { Metadata } from './metadata';

export type BuildStaticContext = {
  job: Job;
  metadata: Metadata | null;
  env: Env;
};
