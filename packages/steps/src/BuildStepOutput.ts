import { BuildStepOutputError } from './errors/BuildStepOutputError.js';

export class BuildStepOutput {
  public readonly id: string;

  private readonly required: boolean;
  private _value?: string;

  constructor({ id, required = true }: { id: string; required?: boolean }) {
    this.id = id;
    this.required = required;
  }

  get value(): string | undefined {
    if (this.required && this._value === undefined) {
      throw new BuildStepOutputError(
        `Output parameter "${this.id}" is required but it was not set.`
      );
    }
    return this._value;
  }

  set(value: string | undefined): BuildStepOutput {
    if (this.required && value === undefined) {
      throw new BuildStepOutputError(`Output parameter "${this.id}" is required.`);
    }
    this._value = value;
    return this;
  }
}
