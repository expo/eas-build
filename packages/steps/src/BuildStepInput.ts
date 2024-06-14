import assert from 'assert';

import { bunyan } from '@expo/logger';

import { BuildStepGlobalContext, SerializedBuildStepGlobalContext } from './BuildStepContext.js';
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

export type BuildStepInputValueType<
  T extends BuildStepInputValueTypeName = BuildStepInputValueTypeName,
> = T extends BuildStepInputValueTypeName.STRING
  ? string
  : T extends BuildStepInputValueTypeName.BOOLEAN
    ? boolean
    : T extends BuildStepInputValueTypeName.NUMBER
      ? number
      : Record<string, any>;

export type BuildStepInputValueTypeWithRequired<
  T extends BuildStepInputValueTypeName = BuildStepInputValueTypeName,
  R extends boolean = boolean,
> = R extends true ? BuildStepInputValueType<T> : BuildStepInputValueType<T> | undefined;

export type BuildStepInputById = Record<string, BuildStepInput>;
export type BuildStepInputProvider = (
  ctx: BuildStepGlobalContext,
  stepId: string
) => BuildStepInput;

interface BuildStepInputProviderParams<
  T extends BuildStepInputValueTypeName = BuildStepInputValueTypeName,
  R extends boolean = boolean,
> {
  id: string;
  allowedValues?: BuildStepInputValueType<T>[];
  defaultValue?: BuildStepInputValueType<T>;
  required: R;
  allowedValueTypeName: T;
}

interface BuildStepInputParams<T extends BuildStepInputValueTypeName, R extends boolean>
  extends BuildStepInputProviderParams<T, R> {
  stepDisplayName: string;
}

export interface SerializedBuildStepInput<
  T extends BuildStepInputValueTypeName = BuildStepInputValueTypeName,
  R extends boolean = boolean,
> {
  id: string;
  stepDisplayName: string;
  defaultValue?: BuildStepInputValueType<T>;
  allowedValues?: BuildStepInputValueType<T>[];
  allowedValueTypeName: BuildStepInputValueTypeName;
  required: R;
  value?: BuildStepInputValueType<T>;
  ctx: SerializedBuildStepGlobalContext;
}

export class BuildStepInput<
  T extends BuildStepInputValueTypeName = BuildStepInputValueTypeName,
  R extends boolean = boolean,
> {
  public readonly id: string;
  public readonly stepDisplayName: string;
  public readonly defaultValue?: BuildStepInputValueType<T>;
  public readonly allowedValues?: BuildStepInputValueType<T>[];
  public readonly allowedValueTypeName: T;
  public readonly required: R;

  private _value?: BuildStepInputValueType<T>;

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
      required,
      allowedValueTypeName,
    }: BuildStepInputParams<T, R>
  ) {
    this.id = id;
    this.stepDisplayName = stepDisplayName;
    this.allowedValues = allowedValues;
    this.defaultValue = defaultValue;
    this.required = required;
    this.allowedValueTypeName = allowedValueTypeName;
  }

  public get value(): BuildStepInputValueTypeWithRequired<T, R> {
    const rawValue = this._value ?? this.defaultValue;
    if (this.required && rawValue === undefined) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step "${this.stepDisplayName}" is required but it was not set.`
      );
    }

    const valueDoesNotRequireInterpolation =
      rawValue === undefined || typeof rawValue === 'boolean' || typeof rawValue === 'number';
    let returnValue;
    if (valueDoesNotRequireInterpolation) {
      if (typeof rawValue !== this.allowedValueTypeName && rawValue !== undefined) {
        throw new BuildStepRuntimeError(
          `Input parameter "${this.id}" for step "${this.stepDisplayName}" must be of type "${this.allowedValueTypeName}".`
        );
      }
      returnValue = rawValue as BuildStepInputValueTypeWithRequired<T, R>;
    } else {
      // `valueDoesNotRequireInterpolation` checks that `rawValue` is not undefined
      // so this will never be true.
      assert(rawValue !== undefined);
      const valueInterpolatedWithGlobalContext = this.ctx.interpolate(rawValue);
      const valueInterpolatedWithOutputsAndGlobalContext = interpolateWithOutputs(
        valueInterpolatedWithGlobalContext,
        (path) => this.ctx.getStepOutputValue(path) ?? ''
      );
      returnValue = this.parseInputValueToAllowedType(valueInterpolatedWithOutputsAndGlobalContext);
    }
    return returnValue;
  }

  public get rawValue(): BuildStepInputValueType<T> | undefined {
    return this._value ?? this.defaultValue;
  }

  public set(value: BuildStepInputValueType<T> | undefined): BuildStepInput {
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

  public serialize(): SerializedBuildStepInput<T, R> {
    return {
      id: this.id,
      stepDisplayName: this.stepDisplayName,
      defaultValue: this.defaultValue,
      allowedValues: this.allowedValues,
      allowedValueTypeName: this.allowedValueTypeName,
      required: this.required,
      value: this._value,
      ctx: this.ctx.serialize(),
    };
  }

  public static deserialize(
    serializedInput: SerializedBuildStepInput,
    logger: bunyan
  ): BuildStepInput {
    const deserializedContext = BuildStepGlobalContext.deserialize(serializedInput.ctx, logger);
    const input = new BuildStepInput(deserializedContext, {
      id: serializedInput.id,
      stepDisplayName: serializedInput.stepDisplayName,
      defaultValue: serializedInput.defaultValue,
      allowedValues: serializedInput.allowedValues,
      allowedValueTypeName: serializedInput.allowedValueTypeName,
      required: serializedInput.required,
    });
    input._value = serializedInput.value;
    return input;
  }

  private parseInputValueToAllowedType(
    value: string | object
  ): BuildStepInputValueTypeWithRequired<T, R> {
    if (typeof value === 'object') {
      return value as BuildStepInputValueTypeWithRequired<T, R>;
    }
    if (this.allowedValueTypeName === BuildStepInputValueTypeName.STRING) {
      return this.parseInputValueToString(value) as BuildStepInputValueTypeWithRequired<T, R>;
    } else if (this.allowedValueTypeName === BuildStepInputValueTypeName.NUMBER) {
      return this.parseInputValueToNumber(value) as BuildStepInputValueTypeWithRequired<T, R>;
    } else if (this.allowedValueTypeName === BuildStepInputValueTypeName.BOOLEAN) {
      return this.parseInputValueToBoolean(value) as BuildStepInputValueTypeWithRequired<T, R>;
    } else {
      return this.parseInputValueToObject(value) as BuildStepInputValueTypeWithRequired<T, R>;
    }
  }

  private parseInputValueToString(value: string): string {
    return JSON.parse(`"${value}"`);
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
