import path from 'path';

import {
  BuildPhase,
  BuildPhaseResult,
  BuildPhaseStats,
  Job,
  LogMarker,
  Env,
  errors,
  Metadata,
  EnvironmentSecretType,
  Workflow,
} from '@expo/eas-build-job';
import { ExpoConfig } from '@expo/config';
import { bunyan } from '@expo/logger';
import { SpawnPromise, SpawnOptions, SpawnResult } from '@expo/turtle-spawn';

import { PackageManager, resolvePackageManager } from './utils/packageManager';
import { resolveBuildPhaseErrorAsync } from './buildErrors/detectError';
import { readAppConfig } from './utils/appConfig';
import { createTemporaryEnvironmentSecretFile } from './utils/environmentSecrets';

export enum ArtifactType {
  APPLICATION_ARCHIVE = 'APPLICATION_ARCHIVE',
  BUILD_ARTIFACTS = 'BUILD_ARTIFACTS',
  /**
   * @deprecated
   */
  XCODE_BUILD_LOGS = 'XCODE_BUILD_LOGS',
}

export type Artifacts = Partial<Record<ArtifactType, string>>;

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
  reportBuildPhaseStats?: (stats: BuildPhaseStats) => void;
  skipNativeBuild?: boolean;
  metadata?: Metadata;
}

export class SkipNativeBuildError extends Error {}

export class BuildContext<TJob extends Job> {
  public readonly workingdir: string;
  public logger: bunyan;
  public readonly logBuffer: LogBuffer;
  private _env: Env;
  public readonly cacheManager?: CacheManager;
  /**
   * @deprecated
   */
  public readonly runGlobalExpoCliCommand: (
    args: string,
    options: SpawnOptions
  ) => SpawnPromise<SpawnResult>;
  public readonly reportError?: (
    msg: string,
    err?: Error,
    options?: { tags?: Record<string, string>; extras?: Record<string, string> }
  ) => void;
  private _job: TJob;
  private _metadata?: Metadata;
  public readonly skipNativeBuild?: boolean;
  public artifacts: Artifacts = {};

  private readonly defaultLogger: bunyan;
  private readonly _uploadArtifacts: (
    type: ArtifactType,
    paths: string[],
    logger?: bunyan
  ) => Promise<string | null>;
  private buildPhase?: BuildPhase;
  private buildPhaseSkipped = false;
  private buildPhaseHasWarnings = false;
  private _appConfig?: ExpoConfig;
  private readonly reportBuildPhaseStats?: (stats: BuildPhaseStats) => void;
  /**
   * If true, that means build was triggered as a CI build, and
   * "eas build:internal" needs to be run to resolve a job object
   * and metadata.
   */
  public readonly isCIBuild: boolean;

  constructor(job: TJob, options: BuildContextOptions) {
    this.workingdir = options.workingdir;
    this.defaultLogger = options.logger;
    this.logger = this.defaultLogger;
    this.logBuffer = options.logBuffer;
    this.cacheManager = options.cacheManager;
    this.runGlobalExpoCliCommand = options.runGlobalExpoCliCommand;
    this._uploadArtifacts = options.uploadArtifacts;
    this.reportError = options.reportError;
    this._job = job;
    this._metadata = options.metadata;
    this.skipNativeBuild = options.skipNativeBuild;
    this.reportBuildPhaseStats = options.reportBuildPhaseStats;
    this.isCIBuild = job.type === Workflow.CI;

    const environmentSecrets = this.getEnvironmentSecrets(job);
    this._env = {
      ...options.env,
      ...job?.builderEnvironment?.env,
      ...environmentSecrets,
    };
  }

  public get job(): TJob {
    return this._job;
  }
  public get metadata(): Metadata | undefined {
    return this._metadata;
  }
  public get env(): Env {
    return this._env;
  }
  public get buildDirectory(): string {
    return path.join(this.workingdir, 'build');
  }
  public get buildLogsDirectory(): string {
    return path.join(this.workingdir, 'logs');
  }
  public get environmentSecrectsDirectory(): string {
    return path.join(this.workingdir, 'environment-secrets');
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
    }: {
      doNotMarkStart?: boolean;
      doNotMarkEnd?: boolean;
    } = {}
  ): Promise<T> {
    let startTimestamp = Date.now();
    try {
      this.setBuildPhase(buildPhase, { doNotMarkStart });
      startTimestamp = Date.now();
      const result = await phase();
      const durationMs = Date.now() - startTimestamp;
      const buildPhaseResult: BuildPhaseResult = this.buildPhaseSkipped
        ? BuildPhaseResult.SKIPPED
        : this.buildPhaseHasWarnings
        ? BuildPhaseResult.WARNING
        : BuildPhaseResult.SUCCESS;
      this.endCurrentBuildPhase({ result: buildPhaseResult, doNotMarkEnd, durationMs });
      return result;
    } catch (err: any) {
      const durationMs = Date.now() - startTimestamp;
      const resolvedError = await this.handleBuildPhaseErrorAsync(err, buildPhase);
      this.endCurrentBuildPhase({ result: BuildPhaseResult.FAIL, durationMs });
      throw resolvedError;
    }
  }

  public markBuildPhaseSkipped(): void {
    this.buildPhaseSkipped = true;
  }

  public markBuildPhaseHasWarnings(): void {
    this.buildPhaseHasWarnings = true;
  }

  public async uploadArtifacts(
    type: ArtifactType,
    paths: string[],
    logger?: bunyan
  ): Promise<void> {
    const url = await this._uploadArtifacts(type, paths, logger);
    if (url) {
      this.artifacts[type] = url;
    }
  }

  public updateEnv(env: Env): void {
    if (!this.isCIBuild) {
      throw new Error('Updating environment variables is only allowed in CI builds.');
    }
    this._env = {
      ...env,
      ...this._env,
    };
  }

  public updateJobInformation(job: TJob, metadata: Metadata): void {
    if (!this.isCIBuild) {
      throw new Error('Updating job information is only allowed in CI builds.');
    }
    this._job = job;
    this._metadata = metadata;
  }

  private async handleBuildPhaseErrorAsync(
    err: any,
    buildPhase: BuildPhase
  ): Promise<errors.BuildError> {
    const buildError = await resolveBuildPhaseErrorAsync(
      err,
      this.logBuffer.getPhaseLogs(buildPhase),
      {
        job: this.job,
        phase: buildPhase,
        env: this.env,
      },
      this.buildLogsDirectory
    );
    if (buildError.errorCode === errors.ErrorCode.UNKNOWN_ERROR) {
      // leaving message empty, website will display err.stack which already includes err.message
      this.logger.error({ err }, '');
    } else {
      this.logger.error(`Error: ${buildError.userFacingMessage}`);
    }
    return buildError;
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
    durationMs,
  }: {
    result: BuildPhaseResult;
    doNotMarkEnd?: boolean;
    durationMs: number;
  }): void {
    if (!this.buildPhase) {
      return;
    }

    this.reportBuildPhaseStats?.({ buildPhase: this.buildPhase, result, durationMs });

    if (!doNotMarkEnd) {
      this.logger.info(
        { marker: LogMarker.END_PHASE, result, durationMs },
        `End phase: ${this.buildPhase}`
      );
    }
    this.logger = this.defaultLogger;
    this.buildPhase = undefined;
    this.buildPhaseSkipped = false;
    this.buildPhaseHasWarnings = false;
  }

  private getEnvironmentSecrets(job: TJob): Record<string, string> {
    if (!job?.secrets?.environmentSecrets) {
      return {};
    }

    const environmentSecrets: Record<string, string> = {};
    for (const { name, type, value } of job.secrets.environmentSecrets) {
      if (type === EnvironmentSecretType.STRING) {
        environmentSecrets[name] = value;
      } else {
        environmentSecrets[name] = createTemporaryEnvironmentSecretFile(
          this.environmentSecrectsDirectory,
          value
        );
      }
    }
    return environmentSecrets;
  }
}
