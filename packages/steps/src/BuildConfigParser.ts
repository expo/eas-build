import fs from 'fs';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';
import YAML from 'yaml';

import { BuildStepConfig, validateBuildConfig } from './BuildConfig.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildWorkflow } from './BuildWorkflow.js';

export class BuildConfigParser {
  private readonly configPath: string;

  constructor(private readonly ctx: BuildStepContext, { configPath }: { configPath: string }) {
    this.configPath = configPath;
  }

  public async parseAsync(): Promise<BuildWorkflow> {
    const rawConfig = await this.readRawConfigAsync();
    const config = validateBuildConfig(rawConfig);
    const steps: BuildStep[] = [];
    for (const stepConfig of config.build.steps) {
      const step = this.createBuildStepFromConfig(stepConfig);
      steps.push(step);
    }
    return new BuildWorkflow({ buildSteps: steps });
  }

  private async readRawConfigAsync(): Promise<any> {
    const contents = await fs.promises.readFile(this.configPath, 'utf-8');
    return YAML.parse(contents);
  }

  private createBuildStepFromConfig(buildStepConfig: BuildStepConfig): BuildStep {
    if (typeof buildStepConfig === 'string') {
      throw new Error('Not implemented yet');
    } else if (typeof buildStepConfig.run === 'string') {
      const command = buildStepConfig.run;
      return new BuildStep(this.ctx, {
        id: uuidv4(),
        workingDirectory: this.ctx.workingDirectory,
        command,
      });
    } else {
      const { id, name, workingDirectory, shell, command } = buildStepConfig.run;
      return new BuildStep(this.ctx, {
        id: id ?? uuidv4(),
        name,
        workingDirectory:
          workingDirectory !== undefined
            ? path.resolve(this.ctx.workingDirectory, workingDirectory)
            : this.ctx.workingDirectory,
        shell,
        command,
      });
    }
  }
}
