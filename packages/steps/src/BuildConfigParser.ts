import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';
import YAML from 'yaml';

import {
  BuildConfig,
  BuildFunctionConfig,
  BuildFunctionInputs,
  BuildFunctionOutputs,
  BuildStepConfig,
  BuildStepInputs,
  BuildStepOutputs,
  isBuildStepBareCommandRun,
  isBuildStepBareFunctionCall,
  isBuildStepCommandRun,
  validateBuildConfig,
} from './BuildConfig.js';
import { BuildFunction, BuildFunctionById } from './BuildFunction.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepInput, BuildStepInputCreator } from './BuildStepInput.js';
import { BuildStepOutput, BuildStepOutputCreator } from './BuildStepOutput.js';
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
    if (isBuildStepCommandRun(buildStepConfig)) {
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
        inputsConfig &&
        this.createBuildStepInputsFromBuildStepInputsDefinition(inputsConfig, stepId);
      const outputs =
        outputsConfig && this.createBuildStepOutputsFromDefinition(outputsConfig, stepId);
      return new BuildStep(this.ctx, {
        id: stepId,
        inputs,
        outputs,
        name,
        workingDirectory: this.getStepWorkingDirectory(workingDirectory),
        shell,
        command,
      });
    } else if (isBuildStepBareCommandRun(buildStepConfig)) {
      const command = buildStepConfig.run;
      return new BuildStep(this.ctx, {
        id: uuidv4(),
        workingDirectory: this.ctx.workingDirectory,
        command,
      });
    } else if (isBuildStepBareFunctionCall(buildStepConfig)) {
      const functionId = buildStepConfig;
      const buildFunction = buildFunctions[functionId];
      return buildFunction.createBuildStepFromFunctionCall(this.ctx, {
        workingDirectory: this.getStepWorkingDirectory(),
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
      return buildFunction.createBuildStepFromFunctionCall(this.ctx, {
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
    const inputCreators =
      inputsConfig && this.createBuildStepInputCreatorsFromBuildFunctionInputs(inputsConfig);
    const outputCreators =
      outputsConfig && this.createBuildStepOutputCreatorsFromBuildFunctionOutputs(outputsConfig);
    return new BuildFunction({ id, name, inputCreators, outputCreators, shell, command });
  }

  private createBuildStepInputsFromBuildStepInputsDefinition(
    buildStepInputs: BuildStepInputs,
    stepId: string
  ): BuildStepInput[] {
    return Object.entries(buildStepInputs).map(
      ([key, value]) =>
        new BuildStepInput(this.ctx, {
          id: key,
          stepId,
          defaultValue: value,
          required: true,
        })
    );
  }

  private createBuildStepInputCreatorsFromBuildFunctionInputs(
    buildFunctionInputs: BuildFunctionInputs
  ): BuildStepInputCreator[] {
    return buildFunctionInputs.map((entry) => {
      if (typeof entry === 'string') {
        return (stepId: string) => new BuildStepInput(this.ctx, { id: entry, stepId });
      } else {
        return (stepId: string) =>
          new BuildStepInput(this.ctx, {
            id: entry.name,
            required: entry.required ?? true,
            stepId,
          });
      }
    });
  }

  private createBuildStepOutputsFromDefinition(
    buildStepOutputs: BuildStepOutputs,
    stepId: string
  ): BuildStepOutput[] {
    return buildStepOutputs.map((entry) =>
      typeof entry === 'string'
        ? new BuildStepOutput(this.ctx, { id: entry, stepId, required: true })
        : new BuildStepOutput(this.ctx, {
            id: entry.name,
            stepId,
            required: entry.required ?? true,
          })
    );
  }

  private createBuildStepOutputCreatorsFromBuildFunctionOutputs(
    buildFunctionOutputs: BuildFunctionOutputs
  ): BuildStepOutputCreator[] {
    return buildFunctionOutputs.map((entry) =>
      typeof entry === 'string'
        ? (stepId: string) => new BuildStepOutput(this.ctx, { id: entry, stepId, required: true })
        : (stepId: string) =>
            new BuildStepOutput(this.ctx, {
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
