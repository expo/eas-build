import { BuildStepGlobalContext } from './BuildStepContext.js';
import { BuildStepRuntimeError } from './errors.js';

export type BuildStepOutputById = Record<string, BuildStepOutput>;
export type BuildStepOutputProvider = (
  ctx: BuildStepGlobalContext,
  stepDisplayName: string
) => BuildStepOutput;

interface BuildStepOutputProviderParams {
  id: string;
  required?: boolean;
}

interface BuildStepOutputParams extends BuildStepOutputProviderParams {
  stepDisplayName: string;
}

export class BuildStepOutput {
  public readonly id: string;
  public readonly stepDisplayName: string;
  public readonly required: boolean;

  private _value?: string;

  public static createProvider(params: BuildStepOutputProviderParams): BuildStepOutputProvider {
    return (ctx, stepDisplayName) => new BuildStepOutput(ctx, { ...params, stepDisplayName });
  }

  constructor(
    // @ts-expect-error ctx is not used in this class but let's keep it here for consistency
    private readonly ctx: BuildStepGlobalContext,
    { id, stepDisplayName, required = true }: BuildStepOutputParams
  ) {
    this.id = id;
    this.stepDisplayName = stepDisplayName;
    this.required = required;
  }

  public get value(): string | undefined {
    if (this.required && this._value === undefined) {
      throw new BuildStepRuntimeError(
        `Output parameter "${this.id}" for step "${this.stepDisplayName}" is required but it was not set.`
      );
    }
    return this._value;
  }

  public set(value: string | undefined): BuildStepOutput {
    if (this.required && value === undefined) {
      throw new BuildStepRuntimeError(
        `Output parameter "${this.id}" for step "${this.stepDisplayName}" is required.`
      );
    }
    this._value = value;
    return this;
  }
}

export function makeBuildStepOutputByIdMap(outputs?: BuildStepOutput[]): BuildStepOutputById {
  if (outputs === undefined) {
    return {};
  }
  return outputs.reduce((acc, output) => {
    acc[output.id] = output;
    return acc;
  }, {} as BuildStepOutputById);
}
