import os from 'os';
import path from 'path';

import { bunyan } from '@expo/logger';

import { BuildStep } from './BuildStep.js';
import { parseOutputPath } from './utils/template.js';
import { BuildStepRuntimeError } from './errors.js';
import { BuildRuntimePlatform } from './BuildRuntimePlatform.js';
import { EasContext } from './EasContext.js';

export class BuildStepContext {
  public readonly stepsInternalBuildDirectory: string;
  public readonly workingDirectory: string;

  private stepById: Record<string, BuildStep> = {};

  constructor(
    public readonly buildId: string,
    public readonly logger: bunyan,
    public readonly skipCleanup: boolean,
    public readonly runtimePlatform: BuildRuntimePlatform,
    public readonly projectSourceDirectory: string,
    public readonly projectTargetDirectory: string,
    public sharedEasContext: EasContext,
    workingDirectory?: string
  ) {
    this.stepsInternalBuildDirectory = path.join(os.tmpdir(), 'eas-build', buildId);
    this.workingDirectory =
      workingDirectory ?? path.join(this.stepsInternalBuildDirectory, 'project');
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

  public getEasContextValue(path: string): string | undefined {
    const arrPath = path.split('.');
    let value: any = this.sharedEasContext;
    for (const key of arrPath) {
      if (!(key in value)) {
        throw new BuildStepRuntimeError(
          `EAS context field "${path}" does not exist. Make sure you are using the correct field name and if so, ensure that steps which sets this field were ran prior to this step.`
        );
      }
      value = value[key];
    }
    if (Buffer.isBuffer(value)) {
      return value.toString();
    }
    if (typeof value !== 'string' && typeof value !== 'undefined') {
      throw new BuildStepRuntimeError(
        `EAS context field "${path}" is not a string or undefined. It is of type "${typeof value}". We currently only support accessing string or undefined values from the EAS context.`
      );
    }
    return value;
  }

  public child({
    logger,
    workingDirectory,
  }: {
    logger?: bunyan;
    workingDirectory?: string;
  } = {}): BuildStepContext {
    return new BuildStepContext(
      this.buildId,
      logger ?? this.logger,
      this.skipCleanup,
      this.runtimePlatform,
      this.projectSourceDirectory,
      this.projectTargetDirectory,
      this.sharedEasContext,
      workingDirectory ?? this.workingDirectory
    );
  }
}
