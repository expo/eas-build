import path from 'path';

import {
  BuildPhase,
  BuildPhaseResult,
  Job,
  LogMarker,
  Env,
  errors,
  Metadata,
} from '@expo/eas-build-job';
import { ExpoConfig } from '@expo/config';
import { bunyan } from '@expo/logger';
import { SpawnPromise, SpawnOptions, SpawnResult } from '@expo/turtle-spawn';

import { PackageManager, resolvePackageManager } from './utils/packageManager';
import { detectUserError } from './utils/detectUserError';
import { readAppConfig } from './utils/appConfig';

export enum ArtifactType {
  APPLICATION_ARCHIVE = 'APPLICATION_ARCHIVE',
  BUILD_ARTIFACTS = 'BUILD_ARTIFACTS',
  /**
   * @deprecated
   */
  XCODE_BUILD_LOGS = 'XCODE_BUILD_LOGS',
}

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
  /**
   * @deprecated
   */
  runGlobalExpoCliCommand: (args: string, options: SpawnOptions) => SpawnPromise<SpawnResult>;
  uploadArtifacts: (type: ArtifactType, paths: string[], logger?: bunyan) => Promise<string | null>;
  reportError?: (
    msg: string,
    err?: Error,
    options?: { tags?: Record<string, string>; extras?: Record<string, string> }
  ) => void;
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
  /**
   * @deprecated
   */
  public readonly runGlobalExpoCliCommand: (
    args: string,
    options: SpawnOptions
  ) => SpawnPromise<SpawnResult>;
  public readonly uploadArtifacts: (
    type: ArtifactType,
    paths: string[],
    logger?: bunyan
  ) => Promise<string | null>;
  public readonly reportError?: (
    msg: string,
    err?: Error,
    options?: { tags?: Record<string, string>; extras?: Record<string, string> }
  ) => void;
  public readonly metadata?: Metadata;
  public readonly skipNativeBuild?: boolean;

  private readonly defaultLogger: bunyan;
  private buildPhase?: BuildPhase;
  private buildPhaseSkipped = false;
  private buildPhaseHasWarnings = false;
  private _appConfig?: ExpoConfig;

  constructor(public readonly job: TJob, options: BuildContextOptions) {
    this.workingdir = options.workingdir;
    this.defaultLogger = options.logger;
    this.logger = this.defaultLogger;
    this.logBuffer = options.logBuffer;
    this.cacheManager = options.cacheManager;
    this.runGlobalExpoCliCommand = options.runGlobalExpoCliCommand;
    this.uploadArtifacts = options.uploadArtifacts;
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
  public get buildLogsDirectory(): string {
    return path.join(this.workingdir, 'logs');
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
    {
      doNotMarkStart = false,
      doNotMarkEnd = false,
      onError,
    }: {
      doNotMarkStart?: boolean;
      doNotMarkEnd?: boolean;
      onError?: (err: Error, logLines: string[]) => void;
    } = {}
  ): Promise<T> {
    try {
      this.setBuildPhase(buildPhase, { doNotMarkStart });
      const result = await phase();
      const buildPhaseResult: BuildPhaseResult = this.buildPhaseSkipped
        ? BuildPhaseResult.SKIPPED
        : this.buildPhaseHasWarnings
        ? BuildPhaseResult.WARNING
        : BuildPhaseResult.SUCCESS;
      this.endCurrentBuildPhase({ result: buildPhaseResult, doNotMarkEnd });
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
      if (onError) {
        onError(userError ?? err, this.logBuffer.getPhaseLogs(buildPhase));
      }
      this.endCurrentBuildPhase({ result: BuildPhaseResult.FAIL });
      throw userError ?? err;
    }
  }

  public markBuildPhaseSkipped(): void {
    this.buildPhaseSkipped = true;
  }

  public markBuildPhaseHasWarnings(): void {
    this.buildPhaseHasWarnings = true;
  }

  private setBuildPhase(buildPhase: BuildPhase, { doNotMarkStart = false } = {}): void {
    if (this.buildPhase) {
      if (this.buildPhase === buildPhase) {
        return;
      } else {
        this.logger.info(
          { marker: LogMarker.END_PHASE, result: BuildPhaseResult.UNKNOWN },
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
    result: BuildPhaseResult;
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
    this.buildPhaseSkipped = false;
    this.buildPhaseHasWarnings = false;
  }
}
