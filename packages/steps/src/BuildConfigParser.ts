import assert from 'assert';
import fs from 'fs/promises';

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
import { BuildStepInput, BuildStepInputProvider } from './BuildStepInput.js';
import { BuildStepOutput, BuildStepOutputProvider } from './BuildStepOutput.js';
import { BuildWorkflow } from './BuildWorkflow.js';
import { BuildWorkflowValidator } from './BuildWorkflowValidator.js';
import { BuildStepRuntimeError } from './errors.js';
import { duplicates } from './utils/expodash/duplicates.js';
import { uniq } from './utils/expodash/uniq.js';

export class BuildConfigParser {
  private readonly configPath: string;
  private readonly externalFunctions?: BuildFunction[];

  constructor(
    private readonly ctx: BuildStepContext,
    { configPath, externalFunctions }: { configPath: string; externalFunctions?: BuildFunction[] }
  ) {
    this.validateExternalFunctions(externalFunctions);

    this.configPath = configPath;
    this.externalFunctions = externalFunctions;
  }

  public async parseAsync(): Promise<BuildWorkflow> {
    const rawConfig = await this.readRawConfigAsync();
    const config = validateBuildConfig(rawConfig, this.getUniqueExternalFunctionIds());
    const configBuildFunctions = this.createBuildFunctionsFromConfig(config.functions);
    const buildFunctions = this.mergeBuildFunctionsWithExternal(
      configBuildFunctions,
      this.externalFunctions
    );
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
        workingDirectory,
        shell,
        command,
      });
    } else if (isBuildStepBareCommandRun(buildStepConfig)) {
      const command = buildStepConfig.run;
      return new BuildStep(this.ctx, {
        id: uuidv4(),
        command,
      });
    } else if (isBuildStepBareFunctionCall(buildStepConfig)) {
      const functionId = buildStepConfig;
      const buildFunction = buildFunctions[functionId];
      return buildFunction.createBuildStepFromFunctionCall(this.ctx);
    } else {
      const keys = Object.keys(buildStepConfig);
      assert(
        keys.length === 1,
        'There must be at most one function call in the step (enforced by joi).'
      );
      const functionId = keys[0];
      const buildFunctionCallConfig = buildStepConfig[functionId];
      const buildFunction = buildFunctions[functionId];
      return buildFunction.createBuildStepFromFunctionCall(this.ctx, {
        id: buildFunctionCallConfig.id,
        name: buildFunctionCallConfig.name,
        callInputs: buildFunctionCallConfig.inputs,
        workingDirectory: buildFunctionCallConfig.workingDirectory,
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
      const buildFunction = this.createBuildFunctionFromConfig({
        id: functionId,
        ...buildFunctionConfig,
      });
      result[buildFunction.getFullId()] = buildFunction;
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
  }: BuildFunctionConfig & { id: string }): BuildFunction {
    const inputProviders =
      inputsConfig && this.createBuildStepInputProvidersFromBuildFunctionInputs(inputsConfig);
    const outputProviders =
      outputsConfig && this.createBuildStepOutputProvidersFromBuildFunctionOutputs(outputsConfig);
    return new BuildFunction({ id, name, inputProviders, outputProviders, shell, command });
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

  private createBuildStepInputProvidersFromBuildFunctionInputs(
    buildFunctionInputs: BuildFunctionInputs
  ): BuildStepInputProvider[] {
    return buildFunctionInputs.map((entry) => {
      return typeof entry === 'string'
        ? BuildStepInput.createProvider({ id: entry })
        : BuildStepInput.createProvider({ id: entry.name, required: entry.required ?? true });
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

  private createBuildStepOutputProvidersFromBuildFunctionOutputs(
    buildFunctionOutputs: BuildFunctionOutputs
  ): BuildStepOutputProvider[] {
    return buildFunctionOutputs.map((entry) =>
      typeof entry === 'string'
        ? BuildStepOutput.createProvider({ id: entry, required: true })
        : BuildStepOutput.createProvider({ id: entry.name, required: entry.required ?? true })
    );
  }

  private mergeBuildFunctionsWithExternal(
    configFunctions: BuildFunctionById,
    externalFunctions?: BuildFunction[]
  ): BuildFunctionById {
    const result: BuildFunctionById = { ...configFunctions };
    if (externalFunctions === undefined) {
      return result;
    }
    for (const buildFunction of externalFunctions) {
      // functions defined in config shadow the external ones
      const fullId = buildFunction.getFullId();
      if (!(fullId in result)) {
        result[fullId] = buildFunction;
      }
    }
    return result;
  }

  private validateExternalFunctions(externalFunctions?: BuildFunction[]): void {
    if (externalFunctions === undefined) {
      return;
    }
    const externalFunctionIds = externalFunctions.map((f) => f.getFullId());
    const duplicatedExternalFunctionIds = duplicates(externalFunctionIds);
    if (duplicatedExternalFunctionIds.length === 0) {
      return;
    }
    throw new BuildStepRuntimeError(
      `Provided external functions with duplicated IDs: ${duplicatedExternalFunctionIds
        .map((id) => `"${id}"`)
        .join(', ')}`
    );
  }

  private getUniqueExternalFunctionIds(): string[] {
    if (this.externalFunctions === undefined) {
      return [];
    }
    const ids = this.externalFunctions.map((f) => f.getFullId());
    return uniq(ids);
  }
}
