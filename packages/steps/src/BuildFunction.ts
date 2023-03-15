import { v4 as uuidv4 } from 'uuid';

import { BuildPlatform } from './BuildPlatform.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepInputProvider } from './BuildStepInput.js';
import { BuildStepOutputProvider } from './BuildStepOutput.js';

export type BuildFunctionById = Record<string, BuildFunction>;
export type BuildFunctionCallInputs = Record<string, string>;

export class BuildFunction {
  public readonly id?: string;
  public readonly name?: string;
  public readonly platforms?: BuildPlatform[];
  public readonly inputProviders?: BuildStepInputProvider[];
  public readonly outputProviders?: BuildStepOutputProvider[];
  public readonly command: string;
  public readonly shell?: string;

  constructor({
    id,
    name,
    platforms,
    inputProviders,
    outputProviders,
    command,
    shell,
  }: {
    id?: string;
    name?: string;
    platforms?: BuildPlatform[];
    inputProviders?: BuildStepInputProvider[];
    outputProviders?: BuildStepOutputProvider[];
    command: string;
    shell?: string;
  }) {
    this.id = id;
    this.name = name;
    this.platforms = platforms;
    this.inputProviders = inputProviders;
    this.outputProviders = outputProviders;
    this.command = command;
    this.shell = shell;
  }

  public createBuildStepFromFunctionCall(
    ctx: BuildStepContext,
    {
      id,
      callInputs = {},
      workingDirectory,
      shell,
    }: {
      id?: string;
      callInputs?: BuildFunctionCallInputs;
      workingDirectory: string;
      shell?: string;
    }
  ): BuildStep {
    const buildStepId = id ?? this.id ?? uuidv4();

    const inputs = this.inputProviders?.map((inputProvider) => {
      const input = inputProvider(buildStepId);
      if (input.id in callInputs) {
        input.set(callInputs[input.id]);
      }
      return input;
    });
    const outputs = this.outputProviders?.map((outputProvider) => outputProvider(buildStepId));

    return new BuildStep(ctx, {
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
