import { BuildStep } from './BuildStep.js';
import { BuildStepEnv } from './BuildStepEnv.js';

export class BuildWorkflow {
  public readonly buildSteps: BuildStep[];

  constructor({ buildSteps }: { buildSteps: BuildStep[] }) {
    this.buildSteps = buildSteps;
  }

  public async executeAsync(env: BuildStepEnv = process.env): Promise<void> {
    for (const step of this.buildSteps) {
      await step.executeAsync(env);
    }
  }
}
