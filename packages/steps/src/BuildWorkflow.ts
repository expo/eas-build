import { BuildFunctionById } from './BuildFunction.js';
import { BuildStep, BuildStepStatus } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepEnv } from './BuildStepEnv.js';

export class BuildWorkflow {
  public readonly buildSteps: BuildStep[];
  public readonly buildFunctions: BuildFunctionById;

  constructor(
    // @ts-expect-error ctx is not used in this class but let's keep it here for consistency
    private readonly ctx: BuildStepContext,
    { buildSteps, buildFunctions }: { buildSteps: BuildStep[]; buildFunctions: BuildFunctionById }
  ) {
    this.buildSteps = buildSteps;
    this.buildFunctions = buildFunctions;
  }

  public async executeAsync(env: BuildStepEnv = process.env): Promise<void> {
    try {
      for (const step of this.buildSteps) {
        await step.executeAsync(env);
      }
    } finally {
      for (const step of this.buildSteps) {
        if (step.status === BuildStepStatus.NEW && step.shouldAlwaysRun) {
          await step.executeAsync(env);
        }
      }
    }
  }
}
