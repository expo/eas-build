import assert from 'assert';

import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepRuntimeError } from './errors/BuildStepRuntimeError.js';

export class BuildStepOutput {
  public readonly id: string;
  public readonly stepId?: string;
  public readonly required: boolean;

  private _value?: string;

  constructor(
    private readonly ctx: BuildStepContext,
    { id, stepId, required = true }: { id: string; stepId?: string; required?: boolean }
  ) {
    this.id = id;
    this.stepId = stepId;
    this.required = required;
  }

  get value(): string | undefined {
    const { stepId } = this;
    assert(stepId, `.value can't be used when not in step context`);
    if (this.required && this._value === undefined) {
      throw new BuildStepRuntimeError(
        `Output parameter "${this.id}" for step "${stepId}" is required but it was not set.`
      );
    }
    return this._value;
  }

  set(value: string | undefined): BuildStepOutput {
    const { stepId } = this;
    assert(
      stepId,
      `.set(${value === undefined ? '' : `'${value}'`}) can't be used when not in step context`
    );
    if (this.required && value === undefined) {
      throw new BuildStepRuntimeError(
        `Output parameter "${this.id}" for step "${stepId}" is required.`
      );
    }
    this._value = value;
    return this;
  }

  clone(stepId: string): BuildStepOutput {
    return new BuildStepOutput(this.ctx, {
      id: this.id,
      stepId,
      required: this.required,
    });
  }
}
