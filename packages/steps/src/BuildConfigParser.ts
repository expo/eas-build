import fs from 'fs';

import { v4 as uuidv4 } from 'uuid';
import YAML from 'yaml';

import { BuildConfig, BuildStepConfig, BuildConfigSchema } from './BuildConfig.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildWorkflow } from './BuildWorkflow.js';
import { BuildConfigError } from './errors/BuildConfigError.js';

export class BuildConfigParser {
  private readonly configPath: string;

  constructor(private readonly ctx: BuildStepContext, { configPath }: { configPath: string }) {
    this.configPath = configPath;
  }

  public async parseAsync(): Promise<BuildWorkflow> {
    const rawConfig = await this.readRawConfigAsync();
    const config = this.validateConfig(rawConfig);
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

  private validateConfig(rawConfig: any): BuildConfig {
    const { error, value } = BuildConfigSchema.validate(rawConfig);
    if (error) {
      throw new BuildConfigError();
    }
    return value;
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
      const { id, name, workingDirectory, command } = buildStepConfig.run;
      return new BuildStep(this.ctx, {
        id: id ?? uuidv4(),
        name,
        workingDirectory: workingDirectory ?? this.ctx.workingDirectory,
        command,
      });
    }
  }
}
