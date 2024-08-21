import { BuildFunctionById } from './BuildFunction.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepGlobalContext } from './BuildStepContext.js';

export class BuildWorkflow {
  public readonly buildSteps: BuildStep[];
  public readonly buildFunctions: BuildFunctionById;

  constructor(
    // @ts-expect-error ctx is not used in this class but let's keep it here for consistency
    private readonly ctx: BuildStepGlobalContext,
    { buildSteps, buildFunctions }: { buildSteps: BuildStep[]; buildFunctions: BuildFunctionById }
  ) {
    this.buildSteps = buildSteps;
    this.buildFunctions = buildFunctions;
  }

  public async executeAsync(): Promise<void> {
    let maybeError: Error | null = null;
    let hasAnyPreviousStepFailed = false;
    for (const step of this.buildSteps) {
      let shouldExecuteStep = false;
      try {
        shouldExecuteStep = step.shouldExecuteStep(hasAnyPreviousStepFailed);
      } catch (err: any) {
        step.ctx.logger.error({ err });
        step.ctx.logger.error(
          `Runner failed to evaluate if it should execute step "${step.displayName}", using step's if condition "${step.ifCondition}". This can be caused by trying to access non-existing object property. If you think this is a bug report it here: https://github.com/expo/eas-cli/issues.`
        );
        maybeError = maybeError ?? err;
        hasAnyPreviousStepFailed = true;
      }
      if (shouldExecuteStep) {
        try {
          await step.executeAsync();
        } catch (err: any) {
          maybeError = maybeError ?? err;
          hasAnyPreviousStepFailed = true;
        }
      } else {
        step.skip();
      }
    }

    if (maybeError) {
      throw maybeError;
    }
  }
}
