import path from 'path';

import { BuildPhase, Job, LogMarker, Env, errors, Metadata } from '@expo/eas-build-job';
import { getConfig, ExpoConfig } from '@expo/config';
import { bunyan } from '@expo/logger';

import { PackageManager, resolvePackageManager } from './utils/packageManager';
import { detectUserError } from './utils/detectUserError';
import { EjectProvider } from './managed/EjectProvider';
import { NpxExpoCliEjectProvider } from './managed/NpxExpoCliEject';

export interface CacheManager {
  saveCache(ctx: BuildContext<Job>): Promise<void>;
  restoreCache(ctx: BuildContext<Job>): Promise<void>;
}

export interface LogBuffer {
  getLogs(): string[];
  getPhaseLogs(buildPhase: string): string[];
}

export interface BuildContextOptions<TJob extends Job> {
  workingdir: string;
  logger: bunyan;
  logBuffer: LogBuffer;
  env: Env;
  cacheManager?: CacheManager;
  ejectProvider?: EjectProvider<TJob>;
  metadata?: Metadata;
}

export class BuildContext<TJob extends Job> {
  public readonly workingdir: string;
  public logger: bunyan;
  public readonly logBuffer: LogBuffer;
  public readonly env: Env;
  public readonly cacheManager?: CacheManager;
  public readonly ejectProvider: EjectProvider<TJob>;
  public readonly metadata?: Metadata;

  private readonly defaultLogger: bunyan;
  private buildPhase?: BuildPhase;
  private _appConfig?: ExpoConfig;

  constructor(public readonly job: TJob, options: BuildContextOptions<TJob>) {
    this.workingdir = options.workingdir;
    this.defaultLogger = options.logger;
    this.logger = this.defaultLogger;
    this.logBuffer = options.logBuffer;
    this.cacheManager = options.cacheManager;
    this.ejectProvider = options.ejectProvider ?? new NpxExpoCliEjectProvider();
    this.metadata = options.metadata;
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
      const originalProcessEnv: NodeJS.ProcessEnv = { ...process.env };
      try {
        for (const [key, value] of Object.entries(this.env)) {
          process.env[key] = value;
        }
        const { exp } = getConfig(this.reactNativeProjectDirectory, {
          skipSDKVersionRequirement: true,
          isPublicConfig: true,
        });
        this._appConfig = exp;
      } finally {
        process.env = originalProcessEnv;
      }
    }
    return this._appConfig;
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
