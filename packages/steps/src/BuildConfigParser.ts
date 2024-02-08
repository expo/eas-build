import assert from 'assert';

import {
  BuildConfig,
  BuildFunctionConfig,
  BuildFunctionInputs,
  BuildFunctionOutputs,
  BuildStepBareCommandRun,
  BuildStepBareFunctionOrFunctionGroupCall,
  BuildStepCommandRun,
  BuildStepConfig,
  BuildStepFunctionCall,
  BuildStepInputs,
  BuildStepOutputs,
  isBuildStepBareCommandRun,
  isBuildStepBareFunctionOrFunctionGroupCall,
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
import { BuildConfigError } from './errors.js';
import { duplicates } from './utils/expodash/duplicates.js';
import { uniq } from './utils/expodash/uniq.js';
import {
  BuildFunctionGroup,
  BuildFunctionGroupById,
  createBuildFunctionGroupByIdMapping,
} from './BuildFunctionGroup.js';

export class BuildConfigParser {
  private readonly configPath: string;
  private readonly externalFunctions?: BuildFunction[];
  private readonly externalFunctionGroups?: BuildFunctionGroup[];

  constructor(
    private readonly ctx: BuildStepGlobalContext,
    {
      configPath,
      externalFunctions,
      externalFunctionGroups,
    }: {
      configPath: string;
      externalFunctions?: BuildFunction[];
      externalFunctionGroups?: BuildFunctionGroup[];
    }
  ) {
    this.validateExternalFunctions(externalFunctions);
    this.validateExternalFunctionGroups(externalFunctionGroups);

    this.configPath = configPath;
    this.externalFunctions = externalFunctions;
    this.externalFunctionGroups = externalFunctionGroups;
  }

  public async parseAsync(): Promise<BuildWorkflow> {
    const config = await readAndValidateBuildConfigAsync(this.configPath, {
      externalFunctionIds: this.getExternalFunctionFullIds(),
      externalFunctionGroupsIds: this.getExternalFunctionGroupFullIds(),
    });
    const configBuildFunctions = this.createBuildFunctionsFromConfig(config.functions);
    const buildFunctions = this.mergeBuildFunctionsWithExternal(
      configBuildFunctions,
      this.externalFunctions
    );
    const buildFunctionGroups = createBuildFunctionGroupByIdMapping(
      this.externalFunctionGroups ?? []
    );
    const buildSteps: BuildStep[] = [];
    for (const stepConfig of config.build.steps) {
      buildSteps.push(
        ...this.createBuildStepFromConfig(stepConfig, buildFunctions, buildFunctionGroups)
      );
    }
    const workflow = new BuildWorkflow(this.ctx, { buildSteps, buildFunctions });
    await new BuildWorkflowValidator(workflow).validateAsync();
    return workflow;
  }

  private createBuildStepFromConfig(
    buildStepConfig: BuildStepConfig,
    buildFunctions: BuildFunctionById,
    buildFunctionGroups: BuildFunctionGroupById
  ): BuildStep[] {
    if (isBuildStepCommandRun(buildStepConfig)) {
      return [this.createBuildStepFromBuildStepCommandRun(buildStepConfig)];
    } else if (isBuildStepBareCommandRun(buildStepConfig)) {
      return [this.createBuildStepFromBuildStepBareCommandRun(buildStepConfig)];
    } else if (isBuildStepBareFunctionOrFunctionGroupCall(buildStepConfig)) {
      return this.createBuildStepsFromBareBuildStepFunctionOrBareBuildStepFunctionGroupCall(
        buildFunctions,
        buildFunctionGroups,
        buildStepConfig
      );
    } else if (buildStepConfig !== null) {
      return [this.createBuildStepFromBuildStepFunctionCall(buildFunctions, buildStepConfig)];
    } else {
      throw new BuildConfigError(
        'Invalid build step configuration detected. Build step cannot be empty.'
      );
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
      if: ifCondition,
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
      ifCondition,
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

  private createBuildStepsFromBuildStepBareFunctionGroupCall(
    buildFunctionGroups: BuildFunctionGroupById,
    functionGroupId: string
  ): BuildStep[] {
    const buildFunctionGroup = buildFunctionGroups[functionGroupId];
    assert(buildFunctionGroup, `Build function group with id "${functionGroupId}" is not defined.`);
    return buildFunctionGroup.createBuildStepsFromFunctionGroupCall(this.ctx);
  }

  private createBuildStepFromBuildStepBareFunctionCall(
    buildFunctions: BuildFunctionById,
    functionId: BuildStepBareFunctionOrFunctionGroupCall
  ): BuildStep {
    const buildFunction = buildFunctions[functionId];
    return buildFunction.createBuildStepFromFunctionCall(this.ctx);
  }

  private createBuildStepsFromBareBuildStepFunctionOrBareBuildStepFunctionGroupCall(
    buildFunctions: BuildFunctionById,
    buildFunctionGroups: BuildFunctionGroupById,
    functionOrFunctionGroupId: string
  ): BuildStep[] {
    const maybeFunctionGroup = buildFunctionGroups[functionOrFunctionGroupId];
    if (maybeFunctionGroup) {
      return this.createBuildStepsFromBuildStepBareFunctionGroupCall(
        buildFunctionGroups,
        functionOrFunctionGroupId
      );
    }
    return [
      this.createBuildStepFromBuildStepBareFunctionCall(buildFunctions, functionOrFunctionGroupId),
    ];
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
      ifCondition: buildFunctionCallConfig.if,
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
    path: customFunctionModulePath,
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
      customFunctionModulePath,
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
        ? BuildStepInput.createProvider({
            id: entry,
            required: true,
            allowedValueTypeName: BuildStepInputValueTypeName.STRING,
          })
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
    throw new BuildConfigError(
      `Provided external functions with duplicated IDs: ${duplicatedExternalFunctionIds
        .map((id) => `"${id}"`)
        .join(', ')}`
    );
  }

  private validateExternalFunctionGroups(externalFunctionGroups?: BuildFunctionGroup[]): void {
    if (externalFunctionGroups === undefined) {
      return;
    }
    const externalFunctionGroupIds = externalFunctionGroups.map((f) => f.getFullId());
    const duplicatedExternalFunctionGroupIds = duplicates(externalFunctionGroupIds);
    if (duplicatedExternalFunctionGroupIds.length === 0) {
      return;
    }
    throw new BuildConfigError(
      `Provided external function groups with duplicated IDs: ${duplicatedExternalFunctionGroupIds
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

  private getExternalFunctionGroupFullIds(): string[] {
    if (this.externalFunctionGroups === undefined) {
      return [];
    }
    const ids = this.externalFunctionGroups.map((f) => f.getFullId());
    return uniq(ids);
  }
}
