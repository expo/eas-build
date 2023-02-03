import { BuildStep } from './BuildStep.js';

export class BuildWorkflow {
  public readonly buildSteps: BuildStep[];

  constructor({ buildSteps }: { buildSteps: BuildStep[] }) {
    this.buildSteps = buildSteps;
  }

  public async executeAsync(): Promise<void> {
    for (const step of this.buildSteps) {
      await step.executeAsync();
    }
  }
}
