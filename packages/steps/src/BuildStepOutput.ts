import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepRuntimeError } from './errors.js';

export type BuildStepOutputById = Record<string, BuildStepOutput>;
export type BuildStepOutputProvider = (
  ctx: BuildStepContext,
  stepDisplayId: string
) => BuildStepOutput;

export class BuildStepOutput {
  public readonly id: string;
  public readonly stepDisplayId: string;
  public readonly required: boolean;

  private _value?: string;

  public static createProvider(params: {
    id: string;
    required?: boolean;
  }): BuildStepOutputProvider {
    return (ctx, stepDisplayId) => new BuildStepOutput(ctx, { ...params, stepDisplayId });
  }

  constructor(
    // @ts-expect-error ctx is not used in this class but let's keep it here for consistency
    private readonly ctx: BuildStepContext,
    {
      id,
      stepDisplayId,
      required = true,
    }: { id: string; stepDisplayId: string; required?: boolean }
  ) {
    this.id = id;
    this.stepDisplayId = stepDisplayId;
    this.required = required;
  }

  get value(): string | undefined {
    if (this.required && this._value === undefined) {
      throw new BuildStepRuntimeError(
        `Output parameter "${this.id}" for step with ${this.stepDisplayId} is required but it was not set.`
      );
    }
    return this._value;
  }

  set(value: string | undefined): BuildStepOutput {
    if (this.required && value === undefined) {
      throw new BuildStepRuntimeError(
        `Output parameter "${this.id}" for step with ${this.stepDisplayId} is required.`
      );
    }
    this._value = value;
    return this;
  }
}

export function makeBuildStepOutputByIdMap(outputs?: BuildStepOutput[]): BuildStepOutputById {
  if (outputs === undefined) {
    return {};
  }
  return outputs.reduce((acc, output) => {
    acc[output.id] = output;
    return acc;
  }, {} as BuildStepOutputById);
}
