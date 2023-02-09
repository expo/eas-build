import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepRuntimeError } from './errors/BuildStepRuntimeError.js';
import { interpolateWithOutputs } from './utils/template.js';

export class BuildStepInput {
  public readonly id: string;
  public readonly stepId: string;
  public readonly defaultValue?: string;
  public readonly required: boolean;

  private _value?: string;

  constructor(
    private readonly ctx: BuildStepContext,
    {
      id,
      stepId,
      defaultValue,
      required = false,
    }: {
      id: string;
      stepId: string;
      defaultValue?: string;
      required?: boolean;
    }
  ) {
    this.id = id;
    this.stepId = stepId;
    this.defaultValue = defaultValue;
    this.required = required;
  }

  get value(): string | undefined {
    const rawValue = this._value ?? this.defaultValue;
    if (this.required && rawValue === undefined) {
      throw new BuildStepRuntimeError(
        `Input parameter "${this.id}" for step "${this.stepId}" is required but it was not set.`
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
        `Input parameter "${this.id}" for step "${this.stepId}" is required.`
      );
    }
    this._value = value;
    return this;
  }
}
