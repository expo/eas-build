import { BuildStepInputError } from './errors/BuildStepInputError.js';

export class BuildStepInput {
  public readonly id: string;

  private readonly defaultValue?: string;
  private readonly required: boolean;
  private _value?: string;

  constructor({
    id,
    defaultValue,
    required = false,
  }: {
    id: string;
    defaultValue?: string;
    required?: boolean;
  }) {
    this.id = id;
    this.defaultValue = defaultValue;
    this.required = required;
  }

  get value(): string | undefined {
    const value = this._value ?? this.defaultValue;
    if (this.required && value === undefined) {
      throw new BuildStepInputError(`Input parameter "${this.id}" is required but it was not set.`);
    }
    return value;
  }

  set(value: string | undefined): BuildStepInput {
    if (this.required && value === undefined) {
      throw new BuildStepInputError(`Input parameter "${this.id}" is required.`);
    }
    this._value = value;
    return this;
  }
}
