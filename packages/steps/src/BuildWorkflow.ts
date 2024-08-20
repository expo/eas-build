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
          `Runner failed to evaluate if it should execute step "${step.displayName}"`
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
