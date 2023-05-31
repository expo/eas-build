import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepRuntimeError } from './errors.js';
import { interpolateWithOutputsAndEasContext } from './utils/template.js';

export type BuildStepInputById = Record<string, BuildStepInput>;
export type BuildStepInputProvider = (ctx: BuildStepContext, stepId: string) => BuildStepInput;

interface BuildStepInputProviderParams {
  id: string;
  allowedValues?: string[];
  defaultValue?: string;
  required?: boolean;
}

interface BuildStepInputParams extends BuildStepInputProviderParams {
  stepDisplayName: string;
}

export class BuildStepInput {
  public readonly id: string;
  public readonly stepDisplayName: string;
  public readonly defaultValue?: string;
  public readonly allowedValues?: string[];
  public readonly required: boolean;

  private _value?: string;

  public static createProvider(params: BuildStepInputProviderParams): BuildStepInputProvider {
    return (ctx, stepDisplayName) => new BuildStepInput(ctx, { ...params, stepDisplayName });
  }

  constructor(
    private readonly ctx: BuildStepContext,
    { id, stepDisplayName, allowedValues, defaultValue, required = true }: BuildStepInputParams
  ) {
    this.id = id;
    this.stepDisplayName = stepDisplayName;
    this.allowedValues = allowedValues;
    this.defaultValue = defaultValue;
    this.required = required;
  }

  public get value(): string | undefined {
    const rawValue = this._value ?? this.defaultValue;
    if (this.required && rawValue === undefined) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step "${this.stepDisplayName}" is required but it was not set.`
      );
    }

    if (rawValue === undefined) {
      return rawValue;
    } else {
      return interpolateWithOutputsAndEasContext(
        rawValue,
        (path) => this.ctx.getStepOutputValue(path) ?? ''
      );
    }
  }

  public set(value: string | undefined): BuildStepInput {
    if (this.required && value === undefined) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step "${this.stepDisplayName}" is required.`
      );
    }
    this._value = value;
    return this;
  }

  public isValueOneOfAllowedValues(): boolean {
    const value = this._value ?? this.defaultValue;
    if (this.allowedValues === undefined || value === undefined) {
      return true;
    }
    return this.allowedValues.includes(value);
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
