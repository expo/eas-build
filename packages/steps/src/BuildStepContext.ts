import os from 'os';
import path from 'path';

import { bunyan } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';

import { BuildStep } from './BuildStep.js';
import {
  getObjectValueForInterpolation,
  interpolateWithGlobalContext,
  parseOutputPath,
} from './utils/template.js';
import { BuildStepRuntimeError } from './errors.js';
import { BuildRuntimePlatform } from './BuildRuntimePlatform.js';
import { BuildStepEnv } from './BuildStepEnv.js';

export interface ExternalBuildContextProvider {
  readonly projectSourceDirectory: string;
  readonly projectTargetDirectory: string;
  readonly defaultWorkingDirectory: string;
  readonly runtimePlatform: BuildRuntimePlatform;
  readonly logger: bunyan;

  readonly staticContext: () => any;

  readonly env: BuildStepEnv;
  updateEnv(env: BuildStepEnv): void;
}

export interface BuildStepGlobalContextJson {
  stepsInternalBuildDirectory: string;
  projectSourceDirectory: string;
  projectTargetDirectory: string;
  defaultWorkingDirectory: string;
  runtimePlatform: BuildRuntimePlatform;
  // baseLogger: bunyan;
  skipCleanup: boolean;
  // stepById: Record<string, BuildStep>;
  staticContext: any;
  env: BuildStepEnv;
  configPath: string;
}

export interface BuildStepContextJson {
  workingDirectory: string;
  global: BuildStepGlobalContextJson;
}

export class BuildStepGlobalContext {
  public readonly stepsInternalBuildDirectory: string;
  public readonly runtimePlatform: BuildRuntimePlatform;
  public readonly baseLogger: bunyan;

  private stepById: Record<string, BuildStep> = {};

  constructor(
    private readonly provider: ExternalBuildContextProvider,
    public readonly skipCleanup: boolean,
    public readonly configPath: string
  ) {
    this.stepsInternalBuildDirectory = path.join(os.tmpdir(), 'eas-build', uuidv4());
    this.runtimePlatform = provider.runtimePlatform;
    this.baseLogger = provider.logger;
  }

  public get projectSourceDirectory(): string {
    return this.provider.projectSourceDirectory;
  }

  public get projectTargetDirectory(): string {
    return this.provider.projectTargetDirectory;
  }

  public get defaultWorkingDirectory(): string {
    return this.provider.defaultWorkingDirectory;
  }

  public get env(): BuildStepEnv {
    return this.provider.env;
  }

  public get staticContext(): Record<string, any> {
    return this.provider.staticContext();
  }

  public updateEnv(updatedEnv: BuildStepEnv): void {
    this.provider.updateEnv(updatedEnv);
  }

  public registerStep(step: BuildStep): void {
    this.stepById[step.id] = step;
  }

  public getStepOutputValue(path: string): string | undefined {
    const { stepId, outputId } = parseOutputPath(path);
    if (!(stepId in this.stepById)) {
      throw new BuildStepRuntimeError(`Step "${stepId}" does not exist.`);
    }
    return this.stepById[stepId].getOutputValueByName(outputId);
  }

  public interpolate(value: string): string {
    return interpolateWithGlobalContext(value, (path) => {
      return (
        getObjectValueForInterpolation(path, {
          eas: {
            runtimePlatform: this.runtimePlatform,
            ...this.staticContext,
          },
        })?.toString() ?? ''
      );
    });
  }

  public stepCtx(options: { logger: bunyan; workingDirectory: string }): BuildStepContext {
    return new BuildStepContext(this, options);
  }

  public toJSON(): BuildStepGlobalContextJson {
    return {
      stepsInternalBuildDirectory: this.stepsInternalBuildDirectory,
      runtimePlatform: this.runtimePlatform,
      projectSourceDirectory: this.projectSourceDirectory,
      projectTargetDirectory: this.projectTargetDirectory,
      defaultWorkingDirectory: this.defaultWorkingDirectory,
      skipCleanup: this.skipCleanup,
      // stepById: this.stepById,
      staticContext: this.staticContext,
      env: this.env,
      configPath: this.configPath,
    };
  }

  public static fromJSON(json: BuildStepGlobalContextJson, logger: bunyan): BuildStepGlobalContext {
    const provider: ExternalBuildContextProvider = {
      projectSourceDirectory: json.projectSourceDirectory,
      projectTargetDirectory: json.projectTargetDirectory,
      defaultWorkingDirectory: json.defaultWorkingDirectory,
      runtimePlatform: json.runtimePlatform,
      logger,
      staticContext: () => json.staticContext,
      env: json.env,
      updateEnv: () => {}, // TODO: figure out how to do this
    };
    const ctx = new BuildStepGlobalContext(provider, json.skipCleanup, json.configPath);
    // ctx.stepById = json.stepById;
    return ctx;
  }
}

export class BuildStepContext {
  public readonly logger: bunyan;
  public readonly workingDirectory: string;

  constructor(
    private readonly ctx: BuildStepGlobalContext,
    {
      logger,
      workingDirectory,
    }: {
      logger: bunyan;
      workingDirectory: string;
    }
  ) {
    this.logger = logger ?? ctx.baseLogger;
    this.workingDirectory = workingDirectory ?? ctx.defaultWorkingDirectory;
  }

  public get global(): BuildStepGlobalContext {
    return this.ctx;
  }

  public toJSON(): BuildStepContextJson {
    return {
      workingDirectory: this.workingDirectory,
      global: this.global.toJSON(),
    };
  }

  public static fromJSON(json: BuildStepContextJson, logger: bunyan): BuildStepContext {
    const ctx = BuildStepGlobalContext.fromJSON(json.global, logger);
    return new BuildStepContext(ctx, {
      logger,
      workingDirectory: json.workingDirectory,
    });
  }
}
