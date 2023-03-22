import os from 'os';
import path from 'path';

import { bunyan } from '@expo/logger';

import { BuildStep } from './BuildStep.js';
import { parseOutputPath } from './utils/template.js';
import { BuildStepRuntimeError } from './errors/BuildStepRuntimeError.js';

export class BuildStepContext {
  public readonly baseWorkingDirectory: string;
  public readonly workingDirectory: string;

  private stepById: Record<string, BuildStep> = {};

  constructor(
    public readonly buildId: string,
    public readonly logger: bunyan,
    public readonly skipCleanup: boolean,
    workingDirectory?: string
  ) {
    this.baseWorkingDirectory = path.join(os.tmpdir(), 'eas-build', buildId);
    this.workingDirectory = workingDirectory ?? path.join(this.baseWorkingDirectory, 'project');
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
      workingDirectory ?? this.workingDirectory
    );
  }
}
