import path from 'path';

import { BuildPhase, Env, Job, Platform } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import { ExternalBuildContextProvider, BuildRuntimePlatform } from '@expo/steps';

import { ArtifactType, BuildContext } from './context';

const platformToBuildRuntimePlatform: Record<Platform, BuildRuntimePlatform> = {
  [Platform.ANDROID]: BuildRuntimePlatform.LINUX,
  [Platform.IOS]: BuildRuntimePlatform.DARWIN,
};

export interface BuilderRuntimeApi {
  uploadArtifacts: (type: ArtifactType, paths: string[], logger: bunyan) => Promise<string | null>;
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

  public readonly logger: bunyan;
  public readonly runtimeApi: BuilderRuntimeApi;
  public readonly job: Job;

  private _env: Env;

  constructor(buildCtx: BuildContext<Job>) {
    this._env = buildCtx.env;
    this.job = buildCtx.job;

    this.logger = buildCtx.logger.child({ phase: BuildPhase.CUSTOM });
    this.projectSourceDirectory = path.join(buildCtx.workingdir, 'temporary-custom-build');
    this.projectTargetDirectory = path.join(buildCtx.workingdir, 'build');
    this.defaultWorkingDirectory = buildCtx.getReactNativeProjectDirectory();
    this.runtimeApi = {
      uploadArtifacts: buildCtx['_uploadArtifacts'],
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
    };
  }

  public updateEnv(env: Env): void {
    this._env = env;
  }
}
