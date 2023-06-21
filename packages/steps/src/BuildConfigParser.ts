import assert from 'assert';

import {
  BuildConfig,
  BuildFunctionConfig,
  BuildFunctionInputs,
  BuildFunctionOutputs,
  BuildStepBareCommandRun,
  BuildStepBareFunctionCall,
  BuildStepCommandRun,
  BuildStepConfig,
  BuildStepFunctionCall,
  BuildStepInputs,
  BuildStepOutputs,
  isBuildStepBareCommandRun,
  isBuildStepBareFunctionCall,
  isBuildStepCommandRun,
  readAndValidateBuildConfigAsync,
} from './BuildConfig.js';
import { BuildFunction, BuildFunctionById } from './BuildFunction.js';
import { BuildStep } from './BuildStep.js';
import {
  BuildStepInput,
  BuildStepInputProvider,
  BuildStepInputValueTypeName,
} from './BuildStepInput.js';
import { BuildStepGlobalContext } from './BuildStepContext.js';
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
    private readonly ctx: BuildStepGlobalContext,
    { configPath, externalFunctions }: { configPath: string; externalFunctions?: BuildFunction[] }
  ) {
    this.validateExternalFunctions(externalFunctions);

    this.configPath = configPath;
    this.externalFunctions = externalFunctions;
  }

  public async parseAsync(): Promise<BuildWorkflow> {
    const config = await readAndValidateBuildConfigAsync(this.configPath, {
      externalFunctionIds: this.getExternalFunctionFullIds(),
    });
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

  private createBuildStepFromConfig(
    buildStepConfig: BuildStepConfig,
    buildFunctions: BuildFunctionById
  ): BuildStep {
    if (isBuildStepCommandRun(buildStepConfig)) {
      return this.createBuildStepFromBuildStepCommandRun(buildStepConfig);
    } else if (isBuildStepBareCommandRun(buildStepConfig)) {
      return this.createBuildStepFromBuildStepBareCommandRun(buildStepConfig);
    } else if (isBuildStepBareFunctionCall(buildStepConfig)) {
      return this.createBuildStepFromBuildStepBareFunctionCall(buildFunctions, buildStepConfig);
    } else {
      return this.createBuildStepFromBuildStepFunctionCall(buildFunctions, buildStepConfig);
    }
  }

  private createBuildStepFromBuildStepCommandRun({ run }: BuildStepCommandRun): BuildStep {
    const {
      id: maybeId,
      inputs: inputsConfig,
      outputs: outputsConfig,
      name,
      workingDirectory,
      shell,
      command,
      env,
    } = run;
    const id = BuildStep.getNewId(maybeId);
    const displayName = BuildStep.getDisplayName({ id, name, command });
    const inputs =
      inputsConfig && this.createBuildStepInputsFromDefinition(inputsConfig, displayName);
    const outputs =
      outputsConfig && this.createBuildStepOutputsFromDefinition(outputsConfig, displayName);
    return new BuildStep(this.ctx, {
      id,
      inputs,
      outputs,
      name,
      displayName,
      workingDirectory,
      shell,
      command,
      env,
    });
  }

  private createBuildStepFromBuildStepBareCommandRun({
    run: command,
  }: BuildStepBareCommandRun): BuildStep {
    const id = BuildStep.getNewId();
    const displayName = BuildStep.getDisplayName({ id, command });
    return new BuildStep(this.ctx, {
      id,
      displayName,
      command,
    });
  }

  private createBuildStepFromBuildStepBareFunctionCall(
    buildFunctions: BuildFunctionById,
    functionId: BuildStepBareFunctionCall
  ): BuildStep {
    const buildFunction = buildFunctions[functionId];
    return buildFunction.createBuildStepFromFunctionCall(this.ctx);
  }

  private createBuildStepFromBuildStepFunctionCall(
    buildFunctions: BuildFunctionById,
    buildStepFunctionCall: BuildStepFunctionCall
  ): BuildStep {
    const keys = Object.keys(buildStepFunctionCall);
    assert(
      keys.length === 1,
      'There must be at most one function call in the step (enforced by joi).'
    );
    const functionId = keys[0];
    const buildFunctionCallConfig = buildStepFunctionCall[functionId];
    const buildFunction = buildFunctions[functionId];
    return buildFunction.createBuildStepFromFunctionCall(this.ctx, {
      id: buildFunctionCallConfig.id,
      name: buildFunctionCallConfig.name,
      callInputs: buildFunctionCallConfig.inputs,
      workingDirectory: buildFunctionCallConfig.workingDirectory,
      shell: buildFunctionCallConfig.shell,
      env: buildFunctionCallConfig.env,
    });
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
    supportedRuntimePlatforms,
  }: BuildFunctionConfig & { id: string }): BuildFunction {
    const inputProviders =
      inputsConfig && this.createBuildStepInputProvidersFromBuildFunctionInputs(inputsConfig);
    const outputProviders =
      outputsConfig && this.createBuildStepOutputProvidersFromBuildFunctionOutputs(outputsConfig);
    return new BuildFunction({
      id,
      name,
      inputProviders,
      outputProviders,
      shell,
      command,
      supportedRuntimePlatforms,
    });
  }

  private createBuildStepInputsFromDefinition(
    buildStepInputs: BuildStepInputs,
    stepDisplayName: string
  ): BuildStepInput[] {
    return Object.entries(buildStepInputs).map(
      ([key, value]) =>
        new BuildStepInput(this.ctx, {
          id: key,
          stepDisplayName,
          defaultValue: value,
          required: true,
          allowedValueTypeName:
            typeof value === 'object'
              ? BuildStepInputValueTypeName.JSON
              : (typeof value as BuildStepInputValueTypeName),
        })
    );
  }

  private createBuildStepInputProvidersFromBuildFunctionInputs(
    buildFunctionInputs: BuildFunctionInputs
  ): BuildStepInputProvider[] {
    return buildFunctionInputs.map((entry) => {
      return typeof entry === 'string'
        ? BuildStepInput.createProvider({ id: entry })
        : BuildStepInput.createProvider({
            id: entry.name,
            required: entry.required ?? true,
            defaultValue: entry.defaultValue,
            allowedValues: entry.allowedValues,
            allowedValueTypeName: entry.allowedValueType,
          });
    });
  }

  private createBuildStepOutputsFromDefinition(
    buildStepOutputs: BuildStepOutputs,
    stepDisplayName: string
  ): BuildStepOutput[] {
    return buildStepOutputs.map((entry) =>
      typeof entry === 'string'
        ? new BuildStepOutput(this.ctx, { id: entry, stepDisplayName, required: true })
        : new BuildStepOutput(this.ctx, {
            id: entry.name,
            stepDisplayName,
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

  private getExternalFunctionFullIds(): string[] {
    if (this.externalFunctions === undefined) {
      return [];
    }
    const ids = this.externalFunctions.map((f) => f.getFullId());
    return uniq(ids);
  }
}
