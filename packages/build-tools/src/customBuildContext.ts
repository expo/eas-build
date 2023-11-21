import path from 'path';

import { BuildPhase, Env, Job, Metadata, Platform } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import { ExternalBuildContextProvider, BuildRuntimePlatform } from '@expo/steps';

import { ArtifactType, BuildContext } from './context';

const platformToBuildRuntimePlatform: Record<Platform, BuildRuntimePlatform> = {
  [Platform.ANDROID]: BuildRuntimePlatform.LINUX,
  [Platform.IOS]: BuildRuntimePlatform.DARWIN,
};

export interface BuilderRuntimeApi {
  uploadArtifacts: (type: ArtifactType, paths: string[], logger: bunyan) => Promise<void>;
}

export class CustomBuildContext implements ExternalBuildContextProvider {
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
  public readonly job: Job;
  public readonly metadata?: Metadata;

  private _env: Env;

  constructor(buildCtx: BuildContext<Job>) {
    this._env = buildCtx.env;
    this.job = buildCtx.job;
    this.metadata = buildCtx.metadata;

    this.logger = buildCtx.logger.child({ phase: BuildPhase.CUSTOM });
    this.projectSourceDirectory = path.join(buildCtx.workingdir, 'temporary-custom-build');
    this.projectTargetDirectory = path.join(buildCtx.workingdir, 'build');
    this.defaultWorkingDirectory = buildCtx.getReactNativeProjectDirectory();
    this.buildLogsDirectory = path.join(buildCtx.workingdir, 'logs');
    this.runtimeApi = {
      uploadArtifacts: (...args) => buildCtx['uploadArtifacts'](...args),
    };
  }

  public get runtimePlatform(): BuildRuntimePlatform {
    return platformToBuildRuntimePlatform[this.job.platform];
  }

  public get env(): Env {
    return this._env;
  }

  public staticContext(): any {
    return {
      job: this.job,
      metadata: this.metadata,
    };
  }

  public updateEnv(env: Env): void {
    this._env = env;
  }
}
