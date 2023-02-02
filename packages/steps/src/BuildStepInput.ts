import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepInputError } from './errors/BuildStepInputError.js';
import { interpolateWithOutputs } from './utils/template.js';

export class BuildStepInput {
  public readonly id: string;
  public readonly defaultValue?: string;
  public readonly required: boolean;

  private _value?: string;

  constructor(
    private readonly ctx: BuildStepContext,
    {
      id,
      defaultValue,
      required = false,
    }: {
      id: string;
      defaultValue?: string;
      required?: boolean;
    }
  ) {
    this.id = id;
    this.defaultValue = defaultValue;
    this.required = required;
  }

  get value(): string | undefined {
    const rawValue = this._value ?? this.defaultValue;
    if (this.required && rawValue === undefined) {
      throw new BuildStepInputError(`Input parameter "${this.id}" is required but it was not set.`);
    }

    if (rawValue === undefined) {
      return rawValue;
    } else {
      return interpolateWithOutputs(rawValue, (path) => this.ctx.getStepOutputValue(path) ?? '');
    }
  }

  set(value: string | undefined): BuildStepInput {
    if (this.required && value === undefined) {
      throw new BuildStepInputError(`Input parameter "${this.id}" is required.`);
    }
    this._value = value;
    return this;
  }
}
