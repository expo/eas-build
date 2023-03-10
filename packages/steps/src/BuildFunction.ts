import { v4 as uuidv4 } from 'uuid';

import { BuildPlatform } from './BuildPlatform.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepInputCreator } from './BuildStepInput.js';
import { BuildStepOutputCreator } from './BuildStepOutput.js';

export type BuildFunctionById = Record<string, BuildFunction>;
export type BuildFunctionCallInputs = Record<string, string>;

export class BuildFunction {
  public readonly id?: string;
  public readonly name?: string;
  public readonly platforms?: BuildPlatform[];
  public readonly inputCreators?: BuildStepInputCreator[];
  public readonly outputCreators?: BuildStepOutputCreator[];
  public readonly command: string;
  public readonly shell?: string;

  constructor(
    private readonly ctx: BuildStepContext,
    {
      id,
      name,
      platforms,
      inputCreators,
      outputCreators,
      command,
      shell,
    }: {
      id?: string;
      name?: string;
      platforms?: BuildPlatform[];
      inputCreators?: BuildStepInputCreator[];
      outputCreators?: BuildStepOutputCreator[];
      command: string;
      shell?: string;
    }
  ) {
    this.id = id;
    this.name = name;
    this.platforms = platforms;
    this.inputCreators = inputCreators;
    this.outputCreators = outputCreators;
    this.command = command;
    this.shell = shell;
  }

  public createBuildStepFromFunctionCall({
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

    const inputs = this.inputCreators?.map((inputCreator) => {
      const input = inputCreator(buildStepId);
      if (input.id in callInputs) {
        input.set(callInputs[input.id]);
      }
      return input;
    });
    const outputs = this.outputCreators?.map((outputCreator) => outputCreator(buildStepId));

    return new BuildStep(this.ctx, {
      id: buildStepId,
      name: this.name,
      command: this.command,
      workingDirectory,
      inputs,
      outputs,
      shell,
    });
  }
}
