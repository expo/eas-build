import { BuildPhase, Env, Job, Platform } from '@expo/eas-build-job';

export interface ErrorContext {
  phase: BuildPhase;
  job: Job;
  env: Env;
}

export interface ErrorHandler<T extends Error> {
  regexp: RegExp | ((ctx: ErrorContext) => RegExp | undefined);
  platform?: Platform;
  phase?: BuildPhase;
  createError: (matchResult: RegExpMatchArray, errCtx: ErrorContext) => T | undefined;
}
