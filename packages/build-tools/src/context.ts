import path from 'path';

import { BuildPhase, Job, LogMarker, Env, errors } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';

import { PackageManager, resolvePackageManager } from './utils/packageManager';
import { detectUserError } from './utils/detectUserError';

export interface CacheManager {
  saveCache(ctx: BuildContext<Job>): Promise<void>;
  restoreCache(ctx: BuildContext<Job>): Promise<void>;
}

export interface LogBuffer {
  getLogs(): string[];
  getPhaseLogs(buildPhase: string): string[];
}

export interface BuildContextOptions {
  workingdir: string;
  logger: bunyan;
  logBuffer: LogBuffer;
  env: Env;
  cacheManager?: CacheManager;
}

export class BuildContext<TJob extends Job> {
  public readonly workingdir: string;
  public logger: bunyan;
  public readonly logBuffer: LogBuffer;
  public readonly env: Env;
  public readonly cacheManager?: CacheManager;

  private readonly defaultLogger: bunyan;
  private buildPhase?: BuildPhase;

  constructor(public readonly job: TJob, options: BuildContextOptions) {
    this.workingdir = options.workingdir;
    this.defaultLogger = options.logger;
    this.logger = this.defaultLogger;
    this.logBuffer = options.logBuffer;
    this.cacheManager = options.cacheManager;
    this.env = {
      ...options.env,
      ...job?.builderEnvironment?.env,
      ...job?.secrets?.environmentSecrets,
    };
  }

  public get buildDirectory(): string {
    return path.join(this.workingdir, 'build');
  }
  public get reactNativeProjectDirectory(): string {
    return path.join(this.buildDirectory, this.job.projectRootDirectory);
  }
  public get packageManager(): PackageManager {
    return resolvePackageManager(this.reactNativeProjectDirectory);
  }

  public async runBuildPhase<T>(buildPhase: BuildPhase, phase: () => Promise<T>): Promise<T> {
    try {
      this.setBuildPhase(buildPhase);
      const result = await phase();
      this.endCurrentBuildPhase({ result: 'success' });
      return result;
    } catch (err) {
      let userError: errors.UserError | undefined;
      if (err instanceof errors.UserError) {
        userError = err;
      } else {
        const detectedError = detectUserError(
          this.logBuffer.getPhaseLogs(buildPhase),
          this.job.platform,
          buildPhase
        );
        if (detectedError) {
          detectedError.innerError = err;
          userError = detectedError;
        }
      }
      if (userError) {
        this.logger.error(`Error: ${userError.message}`);
      } else {
        // leaving message empty, website will display err.stack which already includes err.message
        this.logger.error({ err }, '');
      }
      this.endCurrentBuildPhase({ result: 'failed' });
      throw userError ?? err;
    }
  }

  private setBuildPhase(buildPhase: BuildPhase): void {
    if (this.buildPhase) {
      if (this.buildPhase === buildPhase) {
        return;
      } else {
        this.logger.info(
          { marker: LogMarker.END_PHASE, result: 'unknown' },
          `End phase: ${this.buildPhase}`
        );
        this.logger = this.defaultLogger;
      }
    }
    this.buildPhase = buildPhase;
    this.logger = this.defaultLogger.child({ phase: buildPhase });
    this.logger.info({ marker: LogMarker.START_PHASE }, `Start phase: ${this.buildPhase}`);
  }

  private endCurrentBuildPhase({ result }: { result: 'success' | 'failed' }): void {
    if (!this.buildPhase) {
      return;
    }
    this.logger.info({ marker: LogMarker.END_PHASE, result }, `End phase: ${this.buildPhase}`);
    this.logger = this.defaultLogger;
    this.buildPhase = undefined;
  }
}
