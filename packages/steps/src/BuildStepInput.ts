import { BuildStepGlobalContext } from './BuildStepContext.js';
import { BuildStepRuntimeError } from './errors.js';
import {
  BUILD_STEP_OR_BUILD_GLOBAL_CONTEXT_REFERENCE_REGEX,
  interpolateWithOutputs,
} from './utils/template.js';

export enum BuildStepInputValueTypeName {
  STRING = 'string',
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  JSON = 'json',
}
export type BuildStepInputValueType = string | boolean | number | Record<string, any>;

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

export interface BuildStepInputJson {
  id: string;
  stepDisplayName: string;
  allowedValues?: BuildStepInputValueType[];
  defaultValue?: BuildStepInputValueType;
  required?: boolean;
  allowedValueTypeName?: BuildStepInputValueTypeName;
  _value?: BuildStepInputValueType;
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

    const valueDoesNotRequireInterpolation =
      rawValue === undefined ||
      typeof rawValue === 'boolean' ||
      typeof rawValue === 'number' ||
      typeof rawValue === 'object';
    if (valueDoesNotRequireInterpolation) {
      const currentTypeName =
        typeof rawValue === 'object' ? BuildStepInputValueTypeName.JSON : typeof rawValue;
      if (currentTypeName !== this.allowedValueTypeName && rawValue !== undefined) {
        throw new BuildStepRuntimeError(
          `Input parameter "${this.id}" for step "${this.stepDisplayName}" must be of type "${this.allowedValueTypeName}".`
        );
      }
      return rawValue;
    } else {
      const valueInterpolatedWithGlobalContext = this.ctx.interpolate(rawValue);
      const valueInterpolatedWithOutputsAndGlobalContext = interpolateWithOutputs(
        valueInterpolatedWithGlobalContext,
        (path) => this.ctx.getStepOutputValue(path) ?? ''
      );
      return this.parseInputValueToAllowedType(valueInterpolatedWithOutputsAndGlobalContext);
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

  public isRawValueStepOrContextReference(): boolean {
    return (
      typeof this.rawValue === 'string' &&
      !!BUILD_STEP_OR_BUILD_GLOBAL_CONTEXT_REFERENCE_REGEX.exec(this.rawValue)
    );
  }

  public toJSON(): BuildStepInputJson {
    return {
      id: this.id,
      stepDisplayName: this.stepDisplayName,
      defaultValue: this.defaultValue,
      allowedValues: this.allowedValues,
      required: this.required,
      allowedValueTypeName: this.allowedValueTypeName,
      _value: this._value,
    };
  }

  public static fromJSON(json: BuildStepInputJson, ctx: BuildStepGlobalContext): BuildStepInput {
    const input = new BuildStepInput(ctx, {
      id: json.id,
      stepDisplayName: json.stepDisplayName,
      defaultValue: json.defaultValue,
      allowedValues: json.allowedValues,
      required: json.required,
      allowedValueTypeName: json.allowedValueTypeName,
    });
    input._value = json._value;
    return input;
  }

  private parseInputValueToAllowedType(value: string): BuildStepInputValueType {
    if (this.allowedValueTypeName === BuildStepInputValueTypeName.STRING) {
      return value;
    } else if (this.allowedValueTypeName === BuildStepInputValueTypeName.NUMBER) {
      return this.parseInputValueToNumber(value);
    } else if (this.allowedValueTypeName === BuildStepInputValueTypeName.BOOLEAN) {
      return this.parseInputValueToBoolean(value);
    } else {
      return this.parseInputValueToObject(value);
    }
  }

  private parseInputValueToNumber(value: string): number {
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step "${this.stepDisplayName}" must be of type "${this.allowedValueTypeName}".`
      );
    }
    return numberValue;
  }

  private parseInputValueToBoolean(value: string): boolean {
    if (value === 'true') {
      return true;
    } else if (value === 'false') {
      return false;
    } else {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step "${this.stepDisplayName}" must be of type "${this.allowedValueTypeName}".`
      );
    }
  }

  private parseInputValueToObject(value: string): Record<string, any> {
    try {
      return JSON.parse(value);
    } catch (e: any) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step "${this.stepDisplayName}" must be of type "${this.allowedValueTypeName}".`,
        {
          cause: e,
        }
      );
    }
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
