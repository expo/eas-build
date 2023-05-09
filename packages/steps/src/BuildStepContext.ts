import os from 'os';
import path from 'path';

import { bunyan } from '@expo/logger';

import { BuildStep } from './BuildStep.js';
import { parseOutputPath } from './utils/template.js';
import { BuildStepRuntimeError } from './errors.js';
import { BuildPlatform } from './BuildPlatform.js';

export class BuildStepContext {
  public readonly allowedPlatforms?: BuildPlatform[];
  public readonly baseWorkingDirectory: string;
  public readonly workingDirectory: string;

  private stepById: Record<string, BuildStep> = {};

  constructor(
    public readonly buildId: string,
    public readonly logger: bunyan,
    public readonly skipCleanup: boolean,
    additionalArgs?: { workingDirectory?: string; allowedPlatforms?: BuildPlatform[] }
  ) {
    this.baseWorkingDirectory = path.join(os.tmpdir(), 'eas-build', buildId);
    this.workingDirectory =
      additionalArgs?.workingDirectory ?? path.join(this.baseWorkingDirectory, 'project');
    this.allowedPlatforms = additionalArgs?.allowedPlatforms;
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
    allowedPlatforms: allowedPlatform,
  }: {
    logger?: bunyan;
    workingDirectory?: string;
    allowedPlatforms?: BuildPlatform[];
  } = {}): BuildStepContext {
    return new BuildStepContext(this.buildId, logger ?? this.logger, this.skipCleanup, {
      allowedPlatforms: allowedPlatform ?? this.allowedPlatforms,
      workingDirectory: workingDirectory ?? this.workingDirectory,
    });
  }
}
