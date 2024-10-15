import { DynamicInterpolationContext, Env, StaticWorkflowInterpolationContext } from './common';
import { Job } from './job';
import { Metadata } from './metadata';

type StaticJobOnlyInterpolationContext = {
  job: Job;
  metadata: Metadata | null;
  env: Env;
  steps: Record<
    string,
    {
      outputs: Record<string, string | undefined>;
    }
  >;
};

export type StaticJobInterpolationContext =
  | (StaticWorkflowInterpolationContext & StaticJobOnlyInterpolationContext)
  | StaticJobOnlyInterpolationContext;

export type JobInterpolationContext = StaticJobInterpolationContext & DynamicInterpolationContext;
