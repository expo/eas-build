import { BuildStepGlobalContext } from './BuildStepContext.js';
import { BuildStepRuntimeError } from './errors.js';
import { interpolateWithOutputs } from './utils/template.js';

export enum BuildStepInputValueTypeName {
  STRING = 'string',
  BOOLEAN = 'boolean',
  NUMBER = 'number',
}
export type BuildStepInputValueType = string | boolean | number;

export type BuildStepInputById = Record<string, BuildStepInput>;
export type BuildStepInputProvider = (
  ctx: BuildStepGlobalContext,
  stepId: string
) => BuildStepInput;

interface BuildStepInputProviderParams {
  id: string;
  allowedValues?: BuildStepInputValueType[];
  defaultValue?: BuildStepInputValueType;
  required?: boolean;
  allowedValueTypeName?: BuildStepInputValueTypeName;
}

interface BuildStepInputParams extends BuildStepInputProviderParams {
  stepDisplayName: string;
}

export class BuildStepInput {
  public readonly id: string;
  public readonly stepDisplayName: string;
  public readonly defaultValue?: BuildStepInputValueType;
  public readonly allowedValues?: BuildStepInputValueType[];
  public readonly allowedValueTypeName: BuildStepInputValueTypeName;
  public readonly required: boolean;

  private _value?: BuildStepInputValueType;

  public static createProvider(params: BuildStepInputProviderParams): BuildStepInputProvider {
    return (ctx, stepDisplayName) => new BuildStepInput(ctx, { ...params, stepDisplayName });
  }

  constructor(
    private readonly ctx: BuildStepGlobalContext,
    {
      id,
      stepDisplayName,
      allowedValues,
      defaultValue,
      required = true,
      allowedValueTypeName = BuildStepInputValueTypeName.STRING,
    }: BuildStepInputParams
  ) {
    this.id = id;
    this.stepDisplayName = stepDisplayName;
    this.allowedValues = allowedValues;
    this.defaultValue = defaultValue;
    this.required = required;
    this.allowedValueTypeName = allowedValueTypeName;
  }

  public get value(): BuildStepInputValueType | undefined {
    const rawValue = this._value ?? this.defaultValue;
    if (this.required && rawValue === undefined) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step "${this.stepDisplayName}" is required but it was not set.`
      );
    }
    if (typeof rawValue !== this.allowedValueTypeName && rawValue !== undefined) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step "${this.stepDisplayName}" must be of type "${this.allowedValueTypeName}".`
      );
    }

    if (rawValue === undefined || typeof rawValue === 'boolean' || typeof rawValue === 'number') {
      return rawValue;
    } else {
      return interpolateWithOutputs(rawValue, (path) => this.ctx.getStepOutputValue(path) ?? '');
    }
  }

  public get rawValue(): BuildStepInputValueType | undefined {
    return this._value ?? this.defaultValue;
  }

  public set(value: BuildStepInputValueType | undefined): BuildStepInput {
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
