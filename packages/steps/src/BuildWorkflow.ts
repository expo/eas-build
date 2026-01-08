import { BuildFunctionById } from './BuildFunction.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepGlobalContext } from './BuildStepContext.js';
import { StepMetricResult } from './StepMetrics.js';

export class BuildWorkflow {
  public readonly buildSteps: BuildStep[];
  public readonly buildFunctions: BuildFunctionById;

  constructor(
    private readonly ctx: BuildStepGlobalContext,
    { buildSteps, buildFunctions }: { buildSteps: BuildStep[]; buildFunctions: BuildFunctionById }
  ) {
    this.buildSteps = buildSteps;
    this.buildFunctions = buildFunctions;
  }

  public async executeAsync(): Promise<void> {
    let maybeError: Error | null = null;
    for (const step of this.buildSteps) {
      let shouldExecuteStep = false;

      try {
        shouldExecuteStep = step.shouldExecuteStep();
      } catch (err: any) {
        step.ctx.logger.error({ err });
        step.ctx.logger.error(
          `Runner failed to evaluate if it should execute step "${step.displayName}", using step's if condition "${step.ifCondition}". This can be caused by trying to access non-existing object property. If you think this is a bug report it here: https://github.com/expo/eas-cli/issues.`
        );
        maybeError = maybeError ?? err;
        this.ctx.markAsFailed();
      }

      const startTime = Date.now();
      let stepResult: StepMetricResult | 'skipped';

      if (shouldExecuteStep) {
        try {
          await step.executeAsync();
          stepResult = 'success';
        } catch (err: any) {
          maybeError = maybeError ?? err;
          this.ctx.markAsFailed();
          stepResult = 'failed';
        }
      } else {
        step.skip();
        stepResult = 'skipped';
      }

      this.collectStepMetrics(step, stepResult, Date.now() - startTime);
    }

    if (maybeError) {
      throw maybeError;
    }
  }

  private collectStepMetrics(
    step: BuildStep,
    result: StepMetricResult | 'skipped',
    durationMs: number
  ): void {
    if (result === 'skipped' || !step.__metricsId) {
      return;
    }

    const platform = this.ctx.runtimePlatform === 'darwin' ? 'darwin' : 'linux';

    this.ctx.addStepMetric({
      metricsId: step.__metricsId,
      result,
      durationMs,
      platform,
    });
  }
}
