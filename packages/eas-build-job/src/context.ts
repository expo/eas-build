import { Env } from './common';
import { Job } from './job';
import { Metadata } from './metadata';

export type BuildStaticContext<TJob extends Job = Job> = {
  job: TJob;
  metadata: Metadata | null;
  env: Env;
};
