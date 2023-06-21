import { BuildStepGlobalContext } from './BuildStepContext.js';
import { BuildStepRuntimeError } from './errors.js';
import {
  getObjectValueForInterpolation,
  interpolateWithGlobalContext,
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

    if (
      rawValue === undefined ||
      typeof rawValue === 'boolean' ||
      typeof rawValue === 'number' ||
      typeof rawValue === 'object'
    ) {
      if (
        !(
          typeof rawValue == this.allowedValueTypeName ||
          (typeof rawValue === 'object' &&
            this.allowedValueTypeName === BuildStepInputValueTypeName.JSON)
        ) &&
        rawValue !== undefined
      ) {
        throw new BuildStepRuntimeError(
          `Input parameter "${this.id}" for step "${this.stepDisplayName}" must be of type "${this.allowedValueTypeName}".`
        );
      }
      return rawValue;
    } else {
      const interpolatedWithGlobalContext = interpolateWithGlobalContext(rawValue, (path) => {
        return (
          getObjectValueForInterpolation(path, {
            projectSourceDirectory: this.ctx.projectSourceDirectory,
            projectTargetDirectory: this.ctx.projectTargetDirectory,
            defaultWorkingDirectory: this.ctx.defaultWorkingDirectory,
            runtimePlatform: this.ctx.runtimePlatform,
            ...this.ctx.staticContext,
          })?.toString() ?? ''
        );
      });
      const interpolatedWithOutputsAndGlobalContext = interpolateWithOutputs(
        interpolatedWithGlobalContext,
        (path) => this.ctx.getStepOutputValue(path) ?? ''
      );
      return this.parseInterpolatedInputValueToAllowedType(interpolatedWithOutputsAndGlobalContext);
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

  private parseInterpolatedInputValueToAllowedType(value: string): BuildStepInputValueType {
    if (this.allowedValueTypeName === BuildStepInputValueTypeName.STRING) {
      return value;
    } else if (this.allowedValueTypeName === BuildStepInputValueTypeName.NUMBER) {
      return this.parseInterpolatedInputValueToNumber(value);
    } else if (this.allowedValueTypeName === BuildStepInputValueTypeName.BOOLEAN) {
      return this.parseInterpolatedInputValueToBoolean(value);
    } else {
      return this.parseInterpolatedInputValueToObject(value);
    }
  }

  private parseInterpolatedInputValueToNumber(value: string): number {
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step "${this.stepDisplayName}" must be of type "${this.allowedValueTypeName}".`
      );
    }
    return numberValue;
  }

  private parseInterpolatedInputValueToBoolean(value: string): boolean {
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

  private parseInterpolatedInputValueToObject(value: string): Record<string, any> {
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
