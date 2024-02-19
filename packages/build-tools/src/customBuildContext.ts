import assert from 'assert';
import path from 'path';

import {
  BuildJob,
  BuildPhase,
  BuildStaticContext,
  BuildTrigger,
  Env,
  Job,
  Metadata,
  Platform,
} from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import {
  ExternalBuildContextProvider,
  BuildRuntimePlatform,
  DynamicCacheManager,
} from '@expo/steps';

import { ArtifactToUpload, BuildContext, CacheManager } from './context';

const platformToBuildRuntimePlatform: Record<Platform, BuildRuntimePlatform> = {
  [Platform.ANDROID]: BuildRuntimePlatform.LINUX,
  [Platform.IOS]: BuildRuntimePlatform.DARWIN,
};

export interface BuilderRuntimeApi {
  uploadArtifact: (spec: { artifact: ArtifactToUpload; logger: bunyan }) => Promise<void>;
  cacheManager?: DynamicCacheManager;
}

export class CustomBuildContext<TJob extends Job = Job> implements ExternalBuildContextProvider {
  /*
   * Directory that contains project sources before eas/checkout.
   */
  public readonly projectSourceDirectory: string;

  /*
   * Directory where build is executed. eas/checkout will copy sources here.
   */
  public readonly projectTargetDirectory: string;

  /*
   * Directory where all build steps will be executed unless configured otherwise.
   */
  public readonly defaultWorkingDirectory: string;

  /*
   * Directory where build logs will be stored unless configure otherwise.
   */
  public readonly buildLogsDirectory: string;

  public readonly logger: bunyan;
  public readonly runtimeApi: BuilderRuntimeApi;
  public job: TJob;
  public metadata?: Metadata;
  public readonly cacheManager?: CacheManager;
  public readonly buildDirectory: string;

  private _env: Env;

  constructor(buildCtx: BuildContext<TJob>) {
    this._env = buildCtx.env;
    this.job = buildCtx.job;
    this.metadata = buildCtx.metadata;

    this.logger = buildCtx.logger.child({ phase: BuildPhase.CUSTOM });
    this.projectSourceDirectory = path.join(buildCtx.workingdir, 'temporary-custom-build');
    this.projectTargetDirectory = path.join(buildCtx.workingdir, 'build');
    this.defaultWorkingDirectory = buildCtx.getReactNativeProjectDirectory();
    this.buildLogsDirectory = path.join(buildCtx.workingdir, 'logs');
    this.runtimeApi = {
      uploadArtifact: (...args) => buildCtx['uploadArtifact'](...args),
      cacheManager: buildCtx.dynamicCacheManager,
    };
    this.cacheManager = buildCtx.cacheManager;
    this.buildDirectory = buildCtx.buildDirectory;
  }

  public hasBuildJob(): this is CustomBuildContext<BuildJob> {
    return Boolean(this.job.platform);
  }

  public get runtimePlatform(): BuildRuntimePlatform {
    // Generic jobs are not per-platform.
    if (!this.job.platform) {
      assert(
        process.platform === 'linux' || process.platform === 'darwin',
        `Invalid platform, expected linux or darwin, got: ${process.platform}`
      );
      return {
        linux: BuildRuntimePlatform.LINUX,
        darwin: BuildRuntimePlatform.DARWIN,
      }[process.platform];
    }

    return platformToBuildRuntimePlatform[this.job.platform];
  }

  public get env(): Env {
    return this._env;
  }

  public staticContext(): BuildStaticContext {
    return {
      job: this.job,
      metadata: this.metadata ?? null,
      env: this.env,
    };
  }

  public updateEnv(env: Env): void {
    this._env = env;
  }

  public updateJobInformation(job: TJob, metadata: Metadata): void {
    if (this.job.triggeredBy !== BuildTrigger.GIT_BASED_INTEGRATION) {
      throw new Error(
        'Updating job information is only allowed when build was triggered by a git-based integration.'
      );
    }
    this.job = { ...job, triggeredBy: this.job.triggeredBy };
    this.metadata = metadata;
  }
}
