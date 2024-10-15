import os from 'os';
import path from 'path';

import { BuildStaticContext } from '@expo/eas-build-job';
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
  buildLogsDirectory: string;
  runtimePlatform: BuildRuntimePlatform;
  staticContext: BuildStaticContext;
  env: BuildStepEnv;
}

export interface ExternalBuildContextProvider {
  readonly projectSourceDirectory: string;
  readonly projectTargetDirectory: string;
  readonly defaultWorkingDirectory: string;
  readonly buildLogsDirectory: string;
  readonly runtimePlatform: BuildRuntimePlatform;
  readonly logger: bunyan;

  readonly staticContext: () => BuildStaticContext;

  readonly env: BuildStepEnv;
  updateEnv(env: BuildStepEnv): void;
}

export interface SerializedBuildStepGlobalContext {
  stepsInternalBuildDirectory: string;
  stepById: Record<string, SerializedBuildStepOutputAccessor>;
  provider: SerializedExternalBuildContextProvider;
  skipCleanup: boolean;
}

export class BuildStepGlobalContext {
  public stepsInternalBuildDirectory: string;
  public readonly runtimePlatform: BuildRuntimePlatform;
  public readonly baseLogger: bunyan;
  private didCheckOut = false;
  private _hasAnyPreviousStepFailed = false;
  private stepById: Record<string, BuildStepOutputAccessor> = {};

  constructor(
    private readonly provider: ExternalBuildContextProvider,
    public readonly skipCleanup: boolean
  ) {
    this.stepsInternalBuildDirectory = path.join(os.tmpdir(), 'eas-build', uuidv4());
    this.runtimePlatform = provider.runtimePlatform;
    this.baseLogger = provider.logger;
    this._hasAnyPreviousStepFailed = false;
  }

  public get projectSourceDirectory(): string {
    return this.provider.projectSourceDirectory;
  }

  public get projectTargetDirectory(): string {
    return this.provider.projectTargetDirectory;
  }

  public get defaultWorkingDirectory(): string {
    return this.didCheckOut ? this.provider.defaultWorkingDirectory : this.projectTargetDirectory;
  }

  public get buildLogsDirectory(): string {
    return this.provider.buildLogsDirectory;
  }

  public get env(): BuildStepEnv {
    return this.provider.env;
  }

  public get staticContext(): BuildStaticContext {
    return this.provider.staticContext();
  }

  public updateEnv(updatedEnv: BuildStepEnv): void {
    this.provider.updateEnv(updatedEnv);
  }

  public registerStep(step: BuildStep): void {
    this.stepById[step.id] = step;
  }

  public get steps(): BuildStepOutputAccessor[] {
    return Object.values(this.stepById);
  }

  public getStepOutputValue(path: string): string | undefined {
    const { stepId, outputId } = parseOutputPath(path);
    if (!(stepId in this.stepById)) {
      throw new BuildStepRuntimeError(`Step "${stepId}" does not exist.`);
    }
    return this.stepById[stepId].getOutputValueByName(outputId);
  }

  public interpolate<InterpolableType extends string | object>(
    value: InterpolableType
  ): InterpolableType {
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

  public stepCtx(options: { logger: bunyan; relativeWorkingDirectory?: string }): BuildStepContext {
    return new BuildStepContext(this, options);
  }

  public markAsCheckedOut(logger: bunyan): void {
    this.didCheckOut = true;
    logger.info(
      `Changing default working directory to ${this.defaultWorkingDirectory} (was ${this.projectTargetDirectory})`
    );
  }

  public get hasAnyPreviousStepFailed(): boolean {
    return this._hasAnyPreviousStepFailed;
  }

  public markAsFailed(): void {
    this._hasAnyPreviousStepFailed = true;
  }

  public wasCheckedOut(): boolean {
    return this.didCheckOut;
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
        buildLogsDirectory: this.provider.buildLogsDirectory,
        runtimePlatform: this.provider.runtimePlatform,
        staticContext: this.provider.staticContext(),
        env: this.provider.env,
      },
      skipCleanup: this.skipCleanup,
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
      buildLogsDirectory: serialized.provider.buildLogsDirectory,
      runtimePlatform: serialized.provider.runtimePlatform,
      logger,
      staticContext: () => serialized.provider.staticContext,
      env: serialized.provider.env,
      updateEnv: () => {},
    };
    const ctx = new BuildStepGlobalContext(deserializedProvider, serialized.skipCleanup);
    for (const [id, stepOutputAccessor] of Object.entries(serialized.stepById)) {
      ctx.stepById[id] = BuildStepOutputAccessor.deserialize(stepOutputAccessor);
    }
    ctx.stepsInternalBuildDirectory = serialized.stepsInternalBuildDirectory;

    return ctx;
  }
}

export interface SerializedBuildStepContext {
  relativeWorkingDirectory?: string;
  global: SerializedBuildStepGlobalContext;
}

export class BuildStepContext {
  public readonly logger: bunyan;
  public readonly relativeWorkingDirectory?: string;

  constructor(
    private readonly ctx: BuildStepGlobalContext,
    {
      logger,
      relativeWorkingDirectory,
    }: {
      logger: bunyan;
      relativeWorkingDirectory?: string;
    }
  ) {
    this.logger = logger ?? ctx.baseLogger;
    this.relativeWorkingDirectory = relativeWorkingDirectory;
  }

  public get global(): BuildStepGlobalContext {
    return this.ctx;
  }

  public get workingDirectory(): string {
    return this.relativeWorkingDirectory
      ? path.resolve(this.ctx.defaultWorkingDirectory, this.relativeWorkingDirectory)
      : this.ctx.defaultWorkingDirectory;
  }

  public serialize(): SerializedBuildStepContext {
    return {
      relativeWorkingDirectory: this.relativeWorkingDirectory,
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
      relativeWorkingDirectory: serialized.relativeWorkingDirectory,
    });
  }
}
