import { BuildStep } from './BuildStep.js';
import { BuildWorkflow } from './BuildWorkflow.js';
import { getAllReachablePathsInEasContextObject } from './EasContext.js';
import { BuildConfigError, BuildWorkflowError } from './errors.js';
import { duplicates } from './utils/expodash/duplicates.js';
import { nullthrows } from './utils/nullthrows.js';
import { EAS_CTX_EXPRESSION_REGEXP, findOutputPaths } from './utils/template.js';

export class BuildWorkflowValidator {
  public readonly reachableEasCtxPaths = getAllReachablePathsInEasContextObject();

  constructor(private readonly workflow: BuildWorkflow) {}

  public validate(): void {
    const errors: BuildConfigError[] = [];
    errors.push(...this.validateUniqueStepIds());
    errors.push(...this.validateInputs());
    errors.push(...this.validateAllowedPlatforms());
    errors.push(...this.validateEasContextUsage());
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
          currentStep.ctx.logger.warn('hmm');
          const error = new BuildConfigError(
            `Input parameter "${currentStepInput.id}" for step "${
              currentStep.displayName
            }" is set to "${currentStepInput.getRawValue()}" which is not one of the allowed values: ${nullthrows(
              currentStepInput.allowedValues
            )
              .map((i) => `"${i}"`)
              .join(', ')}.`
          );
          errors.push(error);
        }
        const paths = findOutputPaths(currentStepInput.defaultValue);
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

  private validateEasContextUsage(): BuildConfigError[] {
    const errors: BuildConfigError[] = [];

    for (const currentStep of this.workflow.buildSteps) {
      for (const currentStepInput of currentStep.inputs ?? []) {
        const rawInputValue = currentStepInput.getRawValue();
        if (!rawInputValue) {
          continue;
        }
        const matched = rawInputValue.match(new RegExp(EAS_CTX_EXPRESSION_REGEXP, 'g'));
        if (!matched) {
          continue;
        }
        for (const match of matched) {
          const [, actualPath] = nullthrows(match.match(EAS_CTX_EXPRESSION_REGEXP));
          let isReachable = false;
          for (const reachablePath of this.reachableEasCtxPaths) {
            if (actualPath.match(reachablePath)) {
              isReachable = true;
            }
          }
          if (!isReachable) {
            const error = new BuildConfigError(
              `Input parameter "${currentStepInput.id}" for step "${currentStep.displayName}" uses an expression that references invalid EAS context key "${actualPath}".`
            );
            errors.push(error);
          }
        }
      }
      const command = currentStep.command;
      if (!command) {
        continue;
      }
      const matched = command.match(new RegExp(EAS_CTX_EXPRESSION_REGEXP, 'g'));
      if (!matched) {
        continue;
      }
      for (const match of matched) {
        const [, actualPath] = nullthrows(match.match(EAS_CTX_EXPRESSION_REGEXP));
        let isReachable = false;
        for (const reachablePath of this.reachableEasCtxPaths) {
          if (actualPath.match(reachablePath)) {
            isReachable = true;
          }
        }
        if (!isReachable) {
          const error = new BuildConfigError(
            `Command for step "${currentStep.displayName}" uses an expression that references invalid EAS context key "${actualPath}".`
          );
          errors.push(error);
        }
      }
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
