import { BuildFunction, BuildFunctionById } from './BuildFunction.js';
import { BuildFunctionGroup } from './BuildFunctionGroup.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepGlobalContext } from './BuildStepContext.js';
import { BuildWorkflow } from './BuildWorkflow.js';
import { BuildWorkflowValidator } from './BuildWorkflowValidator.js';
import { BuildConfigError } from './errors.js';
import { duplicates } from './utils/expodash/duplicates.js';
import { uniq } from './utils/expodash/uniq.js';

export abstract class AbstractConfigParser {
  protected readonly externalFunctions?: BuildFunction[];
  protected readonly externalFunctionGroups?: BuildFunctionGroup[];

  constructor(
    protected readonly ctx: BuildStepGlobalContext,
    {
      externalFunctions,
      externalFunctionGroups,
    }: {
      externalFunctions?: BuildFunction[];
      externalFunctionGroups?: BuildFunctionGroup[];
    }
  ) {
    this.validateExternalFunctions(externalFunctions);
    this.validateExternalFunctionGroups(externalFunctionGroups);

    this.externalFunctions = externalFunctions;
    this.externalFunctionGroups = externalFunctionGroups;
  }

  public async parseAsync(): Promise<BuildWorkflow> {
    const { buildSteps, buildFunctionById } =
      await this.parseConfigToBuildStepsAndBuildFunctionByIdMappingAsync();
    const workflow = new BuildWorkflow(this.ctx, { buildSteps, buildFunctions: buildFunctionById });
    await new BuildWorkflowValidator(workflow).validateAsync();
    return workflow;
  }

  protected abstract parseConfigToBuildStepsAndBuildFunctionByIdMappingAsync(): Promise<{
    buildSteps: BuildStep[];
    buildFunctionById: BuildFunctionById;
  }>;

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

  protected getExternalFunctionFullIds(): string[] {
    if (this.externalFunctions === undefined) {
      return [];
    }
    const ids = this.externalFunctions.map((f) => f.getFullId());
    return uniq(ids);
  }

  protected getExternalFunctionGroupFullIds(): string[] {
    if (this.externalFunctionGroups === undefined) {
      return [];
    }
    const ids = this.externalFunctionGroups.map((f) => f.getFullId());
    return uniq(ids);
  }
}
