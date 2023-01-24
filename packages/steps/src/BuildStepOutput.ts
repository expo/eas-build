import { BuildStepOutputError } from './errors/BuildStepOutputError.js';

export class BuildStepOutput {
  public readonly id: string;

  readonly #required: boolean;
  #value?: string;

  constructor({ id, required = true }: { id: string; required?: boolean }) {
    this.id = id;
    this.#required = required;
  }

  get value(): string | undefined {
    if (this.#required && this.#value === undefined) {
      throw new BuildStepOutputError(
        `Output parameter "${this.id}" is required but it was not set.`
      );
    }
    return this.#value;
  }

  set(value: string | undefined): BuildStepOutput {
    if (this.#required && value === undefined) {
      throw new BuildStepOutputError(`Output parameter "${this.id}" is required.`);
    }
    this.#value = value;
    return this;
  }
}
