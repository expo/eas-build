import { BuildStep } from './BuildStep.js';
import { BuildWorkflow } from './BuildWorkflow.js';
import { BuildConfigError, BuildWorkflowError } from './errors.js';
import { duplicates } from './utils/expodash/duplicates.js';
import { nullthrows } from './utils/nullthrows.js';
import { findOutputPaths } from './utils/template.js';

export class BuildWorkflowValidator {
  constructor(private readonly workflow: BuildWorkflow) {}

  public validate(): void {
    const errors: BuildConfigError[] = [];
    errors.push(...this.validateUniqueStepIds());
    errors.push(...this.validateInputs());
    errors.push(...this.validateAllowedPlatforms());
    if (errors.length !== 0) {
      throw new BuildWorkflowError('Build workflow is invalid.', errors);
    }
  }

  private validateUniqueStepIds(): BuildConfigError[] {
    const stepIds = this.workflow.buildSteps.map(({ id }) => id);
    const duplicatedStepIds = duplicates(stepIds);
    if (duplicatedStepIds.length === 0) {
      return [];
    } else {
      const error = new BuildConfigError(
        `Duplicated step IDs: ${duplicatedStepIds.map((i) => `"${i}"`).join(', ')}`
      );
      return [error];
    }
  }

  private validateInputs(): BuildConfigError[] {
    const errors: BuildConfigError[] = [];

    const allStepIds = new Set(this.workflow.buildSteps.map((s) => s.id));
    const visitedStepByStepId: Record<string, BuildStep> = {};
    for (const currentStep of this.workflow.buildSteps) {
      for (const currentStepInput of currentStep.inputs ?? []) {
        if (currentStepInput.defaultValue === undefined) {
          continue;
        }
        if (!currentStepInput.isValueOneOfAllowedValues()) {
          const error = new BuildConfigError(
            `Input parameter "${currentStepInput.id}" for step "${
              currentStep.displayName
            }" is set to "${
              currentStepInput.value
            }" which is not one of the allowed values: ${nullthrows(currentStepInput.allowedValues)
              .map((i) => `"${i}"`)
              .join(', ')}.`
          );
          errors.push(error);
        }
        const paths =
          typeof currentStepInput.defaultValue === 'string'
            ? findOutputPaths(currentStepInput.defaultValue)
            : [];
        for (const { stepId: referencedStepId, outputId: referencedStepOutputId } of paths) {
          if (!(referencedStepId in visitedStepByStepId)) {
            if (allStepIds.has(referencedStepId)) {
              const error = new BuildConfigError(
                `Input parameter "${currentStepInput.id}" for step "${currentStep.displayName}" uses an expression that references an output parameter from the future step "${referencedStepId}".`
              );
              errors.push(error);
            } else {
              const error = new BuildConfigError(
                `Input parameter "${currentStepInput.id}" for step "${currentStep.displayName}" uses an expression that references an output parameter from a non-existent step "${referencedStepId}".`
              );
              errors.push(error);
            }
          } else {
            if (!visitedStepByStepId[referencedStepId].hasOutputParameter(referencedStepOutputId)) {
              const error = new BuildConfigError(
                `Input parameter "${currentStepInput.id}" for step "${currentStep.displayName}" uses an expression that references an undefined output parameter "${referencedStepOutputId}" from step "${referencedStepId}".`
              );
              errors.push(error);
            }
          }
        }
      }
      visitedStepByStepId[currentStep.id] = currentStep;
    }

    return errors;
  }

  private validateAllowedPlatforms(): BuildConfigError[] {
    const errors: BuildConfigError[] = [];
    for (const step of this.workflow.buildSteps) {
      if (!step.canBeRunOnRuntimePlatform()) {
        const error = new BuildConfigError(
          `Step "${step.displayName}" is not allowed on platform "${
            step.ctx.runtimePlatform
          }". Allowed platforms for this step are: ${nullthrows(
            step.supportedRuntimePlatforms,
            `step.supportedRuntimePlatforms can't be falsy if canBeRunOnRuntimePlatform() is false`
          )
            .map((p) => `"${p}"`)
            .join(', ')}.`
        );
        errors.push(error);
      }
    }
    return errors;
  }
}
