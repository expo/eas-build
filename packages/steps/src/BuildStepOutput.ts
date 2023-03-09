import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepRuntimeError } from './errors/BuildStepRuntimeError.js';

export type BuildStepOutputCreator = (stepId: string) => BuildStepOutput;

export class BuildStepOutput {
  public readonly id: string;
  public readonly stepId: string;
  public readonly required: boolean;

  private _value?: string;

  constructor(
    // @ts-expect-error ctx is not used in this class but let's keep it here for consistency
    private readonly ctx: BuildStepContext,
    { id, stepId, required = true }: { id: string; stepId: string; required?: boolean }
  ) {
    this.id = id;
    this.stepId = stepId;
    this.required = required;
  }

  get value(): string | undefined {
    if (this.required && this._value === undefined) {
      throw new BuildStepRuntimeError(
        `Output parameter "${this.id}" for step "${this.stepId}" is required but it was not set.`
      );
    }
    return this._value;
  }

  set(value: string | undefined): BuildStepOutput {
    if (this.required && value === undefined) {
      throw new BuildStepRuntimeError(
        `Output parameter "${this.id}" for step "${this.stepId}" is required.`
      );
    }
    this._value = value;
    return this;
  }
}
