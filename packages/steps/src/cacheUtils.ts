import { bunyan } from '@expo/logger';

export interface Cache {
  disabled: boolean;
  clear: boolean;
  key?: string;
  cacheDefaultPaths?: boolean;
  customPaths?: string[];
  paths: string[];
  downloadUrls?: Record<string, string>;
}

interface CacheableContextCtx {
  buildDirectory: string;
  projectRootDirectory?: string;
  env: Record<string, string | undefined>;
}

export interface CacheableContext {
  logger: bunyan;
  global: CacheableContextCtx;
  workingdir: string;
}

export interface CacheManager {
  // TOOD: Change any to CacheableContext
  saveCache(ctx: any, cache?: Cache): Promise<boolean | void>;
  // TOOD: Change any to CacheableContext
  restoreCache(ctx: any, cache: Cache): Promise<boolean | void>;
  generateUrls?: boolean;
}
