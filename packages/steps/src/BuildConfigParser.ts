import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';
import YAML from 'yaml';

import {
  BuildConfig,
  BuildFunctionConfig,
  BuildFunctionInputsConfig,
  BuildStepConfig,
  BuildStepInputsConfig,
  BuildStepOutputsConfig,
  validateBuildConfig,
} from './BuildConfig.js';
import { BuildFunction, BuildFunctionById } from './BuildFunction.js';
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
    const buildFunctions = this.createBuildFunctionsFromConfig(config.functions);
    const buildSteps = config.build.steps.map((stepConfig) =>
      this.createBuildStepFromConfig(stepConfig, buildFunctions)
    );
    const workflow = new BuildWorkflow(this.ctx, { buildSteps, buildFunctions });
    new BuildWorkflowValidator(workflow).validate();
    return workflow;
  }

  private async readRawConfigAsync(): Promise<any> {
    const contents = await fs.readFile(this.configPath, 'utf-8');
    return YAML.parse(contents);
  }

  private createBuildStepFromConfig(
    buildStepConfig: BuildStepConfig,
    buildFunctions: BuildFunctionById
  ): BuildStep {
    if (typeof buildStepConfig === 'string') {
      const functionId = buildStepConfig;
      const buildFunction = buildFunctions[functionId];
      return buildFunction.toBuildStep({
        workingDirectory: this.getStepWorkingDirectory(),
      });
    } else if (typeof buildStepConfig.run === 'string') {
      const command = buildStepConfig.run;
      return new BuildStep(this.ctx, {
        id: uuidv4(),
        workingDirectory: this.ctx.workingDirectory,
        command,
      });
    } else if ('run' in buildStepConfig) {
      assert('command' in buildStepConfig.run);
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
      const inputs =
        inputsConfig && this.createBuildStepInputsFromBuildStepInputsConfig(inputsConfig, stepId);
      const outputs = outputsConfig && this.createBuildStepOutputsFromConfig(outputsConfig, stepId);
      return new BuildStep(this.ctx, {
        id: stepId,
        inputs,
        outputs,
        name,
        workingDirectory: this.getStepWorkingDirectory(workingDirectory),
        shell,
        command,
      });
    } else {
      const keys = Object.keys(buildStepConfig);
      assert(
        keys.length === 1,
        'There must be at most one function call in the step (enforced by joi)'
      );
      const functionId = keys[0];
      const buildFunctionCallConfig = buildStepConfig[functionId];
      const buildFunction = buildFunctions[functionId];
      return buildFunction.toBuildStep({
        id: buildFunctionCallConfig.id,
        callInputs: buildFunctionCallConfig.inputs,
        workingDirectory: this.getStepWorkingDirectory(buildFunctionCallConfig.workingDirectory),
        shell: buildFunctionCallConfig.shell,
      });
    }
  }

  private createBuildFunctionsFromConfig(
    buildFunctionsConfig: BuildConfig['functions']
  ): BuildFunctionById {
    if (!buildFunctionsConfig) {
      return {};
    }
    const result: BuildFunctionById = {};
    for (const [functionId, buildFunctionConfig] of Object.entries(buildFunctionsConfig)) {
      result[functionId] = this.createBuildFunctionFromConfig(buildFunctionConfig);
    }
    return result;
  }

  private createBuildFunctionFromConfig({
    id,
    name,
    inputs: inputsConfig,
    outputs: outputsConfig,
    shell,
    command,
  }: BuildFunctionConfig): BuildFunction {
    const inputs =
      inputsConfig && this.createBuildStepInputsFromBuildFunctionInputsConfig(inputsConfig);
    const outputs = outputsConfig && this.createBuildStepOutputsFromConfig(outputsConfig);
    return new BuildFunction(this.ctx, { id, name, inputs, outputs, shell, command });
  }

  private createBuildStepInputsFromBuildStepInputsConfig(
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

  private createBuildStepInputsFromBuildFunctionInputsConfig(
    buildFunctionInputsConfig: BuildFunctionInputsConfig
  ): BuildStepInput[] {
    return buildFunctionInputsConfig.map((entry) => {
      if (typeof entry === 'string') {
        return new BuildStepInput(this.ctx, { id: entry });
      } else {
        return new BuildStepInput(this.ctx, {
          id: entry.name,
          required: entry.required ?? true,
        });
      }
    });
  }

  private createBuildStepOutputsFromConfig(
    buildStepOutputsConfig: BuildStepOutputsConfig,
    stepId?: string
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

  private getStepWorkingDirectory(workingDirectory?: string): string {
    return workingDirectory !== undefined
      ? path.resolve(this.ctx.workingDirectory, workingDirectory)
      : this.ctx.workingDirectory;
  }
}
