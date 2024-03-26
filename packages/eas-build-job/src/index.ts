import { Generic } from './generic';
import { BuildJob } from './job';

export * as Android from './android';
export * as Ios from './ios';
export {
  ArchiveSourceType,
  ArchiveSource,
  BuildMode,
  BuildPhaseStats,
  BuildTrigger,
  Env,
  EnvironmentSecret,
  EnvironmentSecretType,
  Workflow,
  Platform,
  Cache,
} from './common';
export { BuildJob, sanitizeBuildJob } from './job';
export { Metadata, sanitizeMetadata } from './metadata';
export * from './logs';
export * as errors from './errors';
export * from './artifacts';
export * from './context';
export * from './generic';

export type Job = BuildJob | Generic.Job;
