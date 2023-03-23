import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepRuntimeError } from './errors.js';
import { interpolateWithOutputs } from './utils/template.js';

export type BuildStepInputById = Record<string, BuildStepInput>;
export type BuildStepInputProvider = (ctx: BuildStepContext, stepId: string) => BuildStepInput;

export class BuildStepInput {
  public readonly id: string;
  public readonly stepDisplayId: string;
  public readonly defaultValue?: string;
  public readonly required: boolean;

  private _value?: string;

  public static createProvider(params: {
    id: string;
    defaultValue?: string;
    required?: boolean;
  }): BuildStepInputProvider {
    return (ctx, stepDisplayId) => new BuildStepInput(ctx, { ...params, stepDisplayId });
  }

  constructor(
    private readonly ctx: BuildStepContext,
    {
      id,
      stepDisplayId,
      defaultValue,
      required = true,
    }: {
      id: string;
      stepDisplayId: string;
      defaultValue?: string;
      required?: boolean;
    }
  ) {
    this.id = id;
    this.stepDisplayId = stepDisplayId;
    this.defaultValue = defaultValue;
    this.required = required;
  }

  get value(): string | undefined {
    const rawValue = this._value ?? this.defaultValue;
    if (this.required && rawValue === undefined) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step with ${this.stepDisplayId} is required but it was not set.`
      );
    }

    if (rawValue === undefined) {
      return rawValue;
    } else {
      return interpolateWithOutputs(rawValue, (path) => this.ctx.getStepOutputValue(path) ?? '');
    }
  }

  set(value: string | undefined): BuildStepInput {
    if (this.required && value === undefined) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step with ${this.stepDisplayId} is required.`
      );
    }
    this._value = value;
    return this;
  }
}

export function makeBuildStepInputByIdMap(inputs?: BuildStepInput[]): BuildStepInputById {
  if (inputs === undefined) {
    return {};
  }
  return inputs.reduce((acc, input) => {
    acc[input.id] = input;
    return acc;
  }, {} as BuildStepInputById);
}
