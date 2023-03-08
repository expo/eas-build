import { v4 as uuidv4 } from 'uuid';

import { BuildPlatform } from './BuildPlatform.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepInput } from './BuildStepInput.js';
import { BuildStepOutput } from './BuildStepOutput.js';

export type BuildFunctionById = Record<string, BuildFunction>;
export type BuildFunctionCallInputs = Record<string, string>;

export class BuildFunction {
  public readonly id?: string;
  public readonly name?: string;
  public readonly platforms?: BuildPlatform[];
  public readonly inputs?: BuildStepInput[];
  public readonly outputs?: BuildStepOutput[];
  public readonly command: string;
  public readonly shell?: string;

  constructor(
    private readonly ctx: BuildStepContext,
    {
      id,
      name,
      platforms,
      inputs,
      outputs,
      command,
      shell,
    }: {
      id?: string;
      name?: string;
      platforms?: BuildPlatform[];
      inputs?: BuildStepInput[];
      outputs?: BuildStepOutput[];
      command: string;
      shell?: string;
    }
  ) {
    this.id = id;
    this.name = name;
    this.platforms = platforms;
    this.inputs = inputs;
    this.outputs = outputs;
    this.command = command;
    this.shell = shell;
  }

  public toBuildStep({
    id,
    callInputs = {},
    workingDirectory,
    shell,
  }: {
    id?: string;
    callInputs?: BuildFunctionCallInputs;
    workingDirectory: string;
    shell?: string;
  }): BuildStep {
    const buildStepId = id ?? this.id ?? uuidv4();

    const stepInputs = this.inputs?.map((i) => {
      const cloned = i.clone(buildStepId);
      if (cloned.id in callInputs) {
        cloned.set(callInputs[cloned.id]);
      }
      return cloned;
    });
    const stepOutputs = this.outputs?.map((o) => o.clone(buildStepId));

    return new BuildStep(this.ctx, {
      id: buildStepId,
      name: this.name,
      command: this.command,
      workingDirectory,
      inputs: stepInputs,
      outputs: stepOutputs,
      shell,
    });
  }
}
