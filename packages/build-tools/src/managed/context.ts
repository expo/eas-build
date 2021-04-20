import { Ios, Android } from '@expo/eas-build-job';

import { BuildContext, BuildContextOptions } from '../context';

import { NpxExpoCliEjectProvider } from './NpxExpoCliEject';
import { EjectProvider } from './EjectProvider';

export type ManagedJob = Ios.ManagedJob | Android.ManagedJob;

interface ManagedBuildContextOptions<TJob extends ManagedJob> extends BuildContextOptions {
  ejectProvider?: EjectProvider<TJob>;
}

export class ManagedBuildContext<TJob extends ManagedJob> extends BuildContext<TJob> {
  public readonly ejectProvider: EjectProvider<TJob>;

  constructor(job: TJob, { ejectProvider, ...otherOptions }: ManagedBuildContextOptions<TJob>) {
    super(job, otherOptions);
    this.ejectProvider = ejectProvider ?? new NpxExpoCliEjectProvider();
  }
}
