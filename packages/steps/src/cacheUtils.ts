import { BuildStepContext } from './BuildStepContext.js';

export interface Cache {
  disabled: boolean;
  clear: boolean;
  key?: string;
  cacheDefaultPaths?: boolean;
  customPaths?: string[];
  paths: string[];
}

export interface DynamicCacheManager {
  saveCache(ctx: BuildStepContext, cache: Cache): Promise<boolean>;
  restoreCache(ctx: BuildStepContext, cache: Cache): Promise<boolean>;
}
