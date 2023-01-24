import { BuildStepInputError } from './errors/BuildStepInputError.js';

export class BuildStepInput {
  public readonly id: string;

  readonly #defaultValue?: string;
  readonly #required: boolean;
  #value?: string;

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
    this.#defaultValue = defaultValue;
    this.#required = required;
  }

  get value(): string | undefined {
    const value = this.#value ?? this.#defaultValue;
    if (this.#required && value === undefined) {
      throw new BuildStepInputError(`Input parameter "${this.id}" is required but it was not set.`);
    }
    return value;
  }

  set(value: string | undefined): BuildStepInput {
    if (this.#required && value === undefined) {
      throw new BuildStepInputError(`Input parameter "${this.id}" is required.`);
    }
    this.#value = value;
    return this;
  }
}
