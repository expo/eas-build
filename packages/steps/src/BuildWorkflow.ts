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
    let hasAnyPreviousStepsFailed = false;
    for (const step of this.buildSteps) {
      if (step.shouldExecuteStep(hasAnyPreviousStepsFailed)) {
        try {
          await step.executeAsync();
        } catch (err: any) {
          maybeError = err;
          hasAnyPreviousStepsFailed = true;
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
