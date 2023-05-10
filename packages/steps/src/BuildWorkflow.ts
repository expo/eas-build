import { BuildFunctionById } from './BuildFunction.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepEnv } from './BuildStepEnv.js';

export class BuildWorkflow {
  public readonly buildSteps: BuildStep[];
  public readonly buildFunctions: BuildFunctionById;

  constructor(
    public readonly ctx: BuildStepContext,
    { buildSteps, buildFunctions }: { buildSteps: BuildStep[]; buildFunctions: BuildFunctionById }
  ) {
    this.buildSteps = buildSteps;
    this.buildFunctions = buildFunctions;
  }

  public async executeAsync(env: BuildStepEnv = process.env): Promise<void> {
    for (const step of this.buildSteps) {
      await step.executeAsync(env);
    }
  }
}
