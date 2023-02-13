import fs from 'fs';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';
import YAML from 'yaml';

import {
  BuildStepConfig,
  BuildStepInputsConfig,
  BuildStepOutputsConfig,
  validateBuildConfig,
} from './BuildConfig.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepInput } from './BuildStepInput.js';
import { BuildStepOutput } from './BuildStepOutput.js';
import { BuildWorkflow } from './BuildWorkflow.js';
import { BuildWorkflowValidator } from './BuildWorkflowValidator.js';

export class BuildConfigParser {
  private readonly configPath: string;

  constructor(private readonly ctx: BuildStepContext, { configPath }: { configPath: string }) {
    this.configPath = configPath;
  }

  public async parseAsync(): Promise<BuildWorkflow> {
    const rawConfig = await this.readRawConfigAsync();
    const config = validateBuildConfig(rawConfig);
    const steps = config.build.steps.map((stepConfig) =>
      this.createBuildStepFromConfig(stepConfig)
    );
    const workflow = new BuildWorkflow({ buildSteps: steps });
    new BuildWorkflowValidator(workflow).validate();
    return workflow;
  }

  private async readRawConfigAsync(): Promise<any> {
    const contents = await fs.promises.readFile(this.configPath, 'utf-8');
    return YAML.parse(contents);
  }

  private createBuildStepFromConfig(buildStepConfig: BuildStepConfig): BuildStep {
    if (typeof buildStepConfig === 'string') {
      // TODO: implement calling functions
      throw new Error('Not implemented yet');
    } else if (typeof buildStepConfig.run === 'string') {
      const command = buildStepConfig.run;
      return new BuildStep(this.ctx, {
        id: uuidv4(),
        workingDirectory: this.ctx.workingDirectory,
        command,
      });
    } else {
      const {
        id,
        inputs: inputsConfig,
        outputs: outputsConfig,
        name,
        workingDirectory,
        shell,
        command,
      } = buildStepConfig.run;
      const stepId = id ?? uuidv4();
      const inputs = inputsConfig && this.createBuildStepInputsFromConfig(inputsConfig, stepId);
      const outputs = outputsConfig && this.createBuildStepOutputsFromConfig(outputsConfig, stepId);
      return new BuildStep(this.ctx, {
        id: stepId,
        inputs,
        outputs,
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

  private createBuildStepInputsFromConfig(
    buildStepInputsConfig: BuildStepInputsConfig,
    stepId: string
  ): BuildStepInput[] {
    return Object.entries(buildStepInputsConfig).map(
      ([key, value]) =>
        new BuildStepInput(this.ctx, {
          id: key,
          stepId,
          defaultValue: value,
          required: true,
        })
    );
  }

  private createBuildStepOutputsFromConfig(
    buildStepOutputsConfig: BuildStepOutputsConfig,
    stepId: string
  ): BuildStepOutput[] {
    return buildStepOutputsConfig.map((entry) =>
      typeof entry === 'string'
        ? new BuildStepOutput(this.ctx, { id: entry, stepId, required: true })
        : new BuildStepOutput(this.ctx, {
            id: entry.name,
            stepId,
            required: entry.required ?? true,
          })
    );
  }
}
