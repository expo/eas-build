import os from 'os';
import path from 'path';

import { bunyan } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';

import {
  BuildStep,
  BuildStepOutputAccessor,
  SerializedBuildStepOutputAccessor,
} from './BuildStep.js';
import {
  getObjectValueForInterpolation,
  interpolateWithGlobalContext,
  parseOutputPath,
} from './utils/template.js';
import { BuildStepRuntimeError } from './errors.js';
import { BuildRuntimePlatform } from './BuildRuntimePlatform.js';
import { BuildStepEnv } from './BuildStepEnv.js';

interface SerializedExternalBuildContextProvider {
  projectSourceDirectory: string;
  projectTargetDirectory: string;
  defaultWorkingDirectory: string;
  runtimePlatform: BuildRuntimePlatform;
  staticContext: Record<string, any>;
  env: BuildStepEnv;
}

export interface ExternalBuildContextProvider {
  readonly projectSourceDirectory: string;
  readonly projectTargetDirectory: string;
  readonly defaultWorkingDirectory: string;
  readonly runtimePlatform: BuildRuntimePlatform;
  readonly logger: bunyan;

  readonly staticContext: () => Record<string, any>;

  readonly env: BuildStepEnv;
  updateEnv(env: BuildStepEnv): void;
}

export interface SerializedBuildStepGlobalContext {
  stepsInternalBuildDirectory: string;
  stepById: Record<string, SerializedBuildStepOutputAccessor>;
  provider: SerializedExternalBuildContextProvider;
  skipCleanup: boolean;
  configPath: string;
}

export class BuildStepGlobalContext {
  public stepsInternalBuildDirectory: string;
  public readonly runtimePlatform: BuildRuntimePlatform;
  public readonly baseLogger: bunyan;

  private stepById: Record<string, BuildStepOutputAccessor> = {};

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

  public serialize(): SerializedBuildStepGlobalContext {
    return {
      stepsInternalBuildDirectory: this.stepsInternalBuildDirectory,
      stepById: Object.fromEntries(
        Object.entries(this.stepById).map(([id, step]) => [id, step.serialize()])
      ),
      provider: {
        projectSourceDirectory: this.provider.projectSourceDirectory,
        projectTargetDirectory: this.provider.projectTargetDirectory,
        defaultWorkingDirectory: this.provider.defaultWorkingDirectory,
        runtimePlatform: this.provider.runtimePlatform,
        staticContext: this.provider.staticContext(),
        env: this.provider.env,
      },
      skipCleanup: this.skipCleanup,
      configPath: this.configPath,
    };
  }

  public static deserialize(
    serialized: SerializedBuildStepGlobalContext,
    logger: bunyan
  ): BuildStepGlobalContext {
    const deserializedProvider: ExternalBuildContextProvider = {
      projectSourceDirectory: serialized.provider.projectSourceDirectory,
      projectTargetDirectory: serialized.provider.projectTargetDirectory,
      defaultWorkingDirectory: serialized.provider.defaultWorkingDirectory,
      runtimePlatform: serialized.provider.runtimePlatform,
      logger,
      staticContext: () => serialized.provider.staticContext,
      env: serialized.provider.env,
      updateEnv: () => {},
    };
    const ctx = new BuildStepGlobalContext(
      deserializedProvider,
      serialized.skipCleanup,
      serialized.configPath
    );
    for (const [id, stepOutputAccessor] of Object.entries(serialized.stepById)) {
      ctx.stepById[id] = BuildStepOutputAccessor.deserialize(stepOutputAccessor);
    }
    ctx.stepsInternalBuildDirectory = serialized.stepsInternalBuildDirectory;

    return ctx;
  }
}

export interface SerializedBuildStepContext {
  workingDirectory: string;
  global: SerializedBuildStepGlobalContext;
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

  public serialize(): SerializedBuildStepContext {
    return {
      workingDirectory: this.workingDirectory,
      global: this.ctx.serialize(),
    };
  }

  public static deserialize(
    serialized: SerializedBuildStepContext,
    logger: bunyan
  ): BuildStepContext {
    const deserializedGlobal = BuildStepGlobalContext.deserialize(serialized.global, logger);
    return new BuildStepContext(deserializedGlobal, {
      logger,
      workingDirectory: serialized.workingDirectory,
    });
  }
}
