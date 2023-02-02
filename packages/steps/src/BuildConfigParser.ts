import fs from 'fs';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';
import YAML from 'yaml';

import {
  BuildStepConfig,
  BuildStepInputs,
  BuildStepOutputs,
  validateBuildConfig,
} from './BuildConfig.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepInput } from './BuildStepInput.js';
import { BuildStepOutput } from './BuildStepOutput.js';
import { BuildWorkflow } from './BuildWorkflow.js';

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
    return new BuildWorkflow({ buildSteps: steps });
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
      const inputs = inputsConfig && this.createBuildStepInputsFromConfig(inputsConfig);
      const outputs = outputsConfig && this.createBuildStepOutputsFromConfig(outputsConfig);
      return new BuildStep(this.ctx, {
        id: id ?? uuidv4(),
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
    buildStepInputsConfig: BuildStepInputs
  ): BuildStepInput[] {
    const inputs: BuildStepInput[] = [];
    for (const [key, value] of Object.entries(buildStepInputsConfig)) {
      const input = new BuildStepInput(this.ctx, { id: key, defaultValue: value, required: true });
      inputs.push(input);
    }
    return inputs;
  }

  private createBuildStepOutputsFromConfig(
    buildStepOutputsConfig: BuildStepOutputs
  ): BuildStepOutput[] {
    const outputs: BuildStepOutput[] = [];
    for (const entry of buildStepOutputsConfig) {
      const output =
        typeof entry === 'string'
          ? new BuildStepOutput(this.ctx, { id: entry, required: true })
          : new BuildStepOutput(this.ctx, { id: entry.name, required: entry.required ?? true });
      outputs.push(output);
    }
    return outputs;
  }
}
