import path from 'path';

import { BuildPhase, Job, LogMarker, Env, errors, Metadata } from '@expo/eas-build-job';
import { ExpoConfig } from '@expo/config';
import { bunyan } from '@expo/logger';
import { SpawnOptions } from '@expo/turtle-spawn';

import { PackageManager, resolvePackageManager } from './utils/packageManager';
import { detectUserError } from './utils/detectUserError';
import { readAppConfig } from './utils/appConfig';

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
  runExpoCliCommand: (args: string, options: SpawnOptions) => Promise<void>;
  reportError?: (msg: string, err?: Error) => void;
  skipNativeBuild?: boolean;
  metadata?: Metadata;
}

export class SkipNativeBuildError extends Error {}

export class BuildContext<TJob extends Job> {
  public readonly workingdir: string;
  public logger: bunyan;
  public readonly logBuffer: LogBuffer;
  public readonly env: Env;
  public readonly cacheManager?: CacheManager;
  public readonly runExpoCliCommand: (args: string, options: SpawnOptions) => Promise<void>;
  public readonly reportError?: (msg: string, err?: Error) => void;
  public readonly metadata?: Metadata;
  public readonly skipNativeBuild?: boolean;

  private readonly defaultLogger: bunyan;
  private buildPhase?: BuildPhase;
  private _appConfig?: ExpoConfig;

  constructor(public readonly job: TJob, options: BuildContextOptions) {
    this.workingdir = options.workingdir;
    this.defaultLogger = options.logger;
    this.logger = this.defaultLogger;
    this.logBuffer = options.logBuffer;
    this.cacheManager = options.cacheManager;
    this.runExpoCliCommand = options.runExpoCliCommand;
    this.reportError = options.reportError;
    this.metadata = options.metadata;
    this.skipNativeBuild = options.skipNativeBuild;
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
  public get appConfig(): ExpoConfig {
    if (!this._appConfig) {
      this._appConfig = readAppConfig(this.reactNativeProjectDirectory, this.env, this.logger).exp;
    }
    return this._appConfig;
  }

  public async runBuildPhase<T>(
    buildPhase: BuildPhase,
    phase: () => Promise<T>,
    { doNotMarkStart = false, doNotMarkEnd = false } = {}
  ): Promise<T> {
    try {
      this.setBuildPhase(buildPhase, { doNotMarkStart });
      const result = await phase();
      this.endCurrentBuildPhase({ result: 'success', doNotMarkEnd });
      return result;
    } catch (err: any) {
      let userError: errors.UserError | undefined;
      if (err instanceof errors.UserError) {
        userError = err;
      } else {
        const detectedError = detectUserError(this.logBuffer.getPhaseLogs(buildPhase), {
          job: this.job,
          phase: buildPhase,
        });
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

  private setBuildPhase(buildPhase: BuildPhase, { doNotMarkStart = false } = {}): void {
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
    if (!doNotMarkStart) {
      this.logger.info({ marker: LogMarker.START_PHASE }, `Start phase: ${this.buildPhase}`);
    }
  }

  private endCurrentBuildPhase({
    result,
    doNotMarkEnd = false,
  }: {
    result: 'success' | 'failed';
    doNotMarkEnd?: boolean;
  }): void {
    if (!this.buildPhase) {
      return;
    }
    if (!doNotMarkEnd) {
      this.logger.info({ marker: LogMarker.END_PHASE, result }, `End phase: ${this.buildPhase}`);
    }
    this.logger = this.defaultLogger;
    this.buildPhase = undefined;
  }
}
