import { BuildStep } from './BuildStep.js';
import { BuildWorkflow } from './BuildWorkflow.js';
import { BuildConfigError } from './errors/BuildConfigError.js';
import { BuildWorkflowError } from './errors/BuildWorkflowError.js';
import { duplicates } from './utils/expodash/duplicates.js';
import { findOutputPaths } from './utils/template.js';

export class BuildWorkflowValidator {
  constructor(private readonly workflow: BuildWorkflow) {}

  public validate(): void {
    const errors: BuildConfigError[] = [];
    errors.push(...this.validateUniqueStepIds());
    errors.push(...this.validateInputs());
    if (errors.length !== 0) {
      throw new BuildWorkflowError('Build workflow is invalid', errors);
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
    const stepByStepId: Record<string, BuildStep> = {};
    for (const step of this.workflow.buildSteps) {
      for (const input of step.inputs ?? []) {
        if (input.defaultValue === undefined) {
          continue;
        }
        const paths = findOutputPaths(input.defaultValue);
        for (const { stepId, outputId } of paths) {
          if (!(stepId in stepByStepId)) {
            if (allStepIds.has(stepId)) {
              const error = new BuildConfigError(
                `Input parameter "${input.id}" for step "${step.id}" uses an expression that references an output parameter from the future step "${stepId}".`
              );
              errors.push(error);
            } else {
              const error = new BuildConfigError(
                `Input parameter "${input.id}" for step "${step.id}" uses an expression that references an output parameter from a non-existent step "${stepId}".`
              );
              errors.push(error);
            }
          } else {
            if (!stepByStepId[stepId].hasOutputParameter(outputId)) {
              const error = new BuildConfigError(
                `Input parameter "${input.id}" for step "${step.id}" uses an expression that references an undefined output parameter "${outputId}" from step "${stepId}".`
              );
              errors.push(error);
            }
          }
        }
      }
      stepByStepId[step.id] = step;
    }

    return errors;
  }
}
