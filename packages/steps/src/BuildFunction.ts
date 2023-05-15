import assert from 'assert';

import { BuildRuntimePlatform } from './BuildRuntimePlatform.js';
import { BuildStep, BuildStepFunction } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepInputProvider } from './BuildStepInput.js';
import { BuildStepOutputProvider } from './BuildStepOutput.js';

export type BuildFunctionById = Record<string, BuildFunction>;
export type BuildFunctionCallInputs = Record<string, string>;

export class BuildFunction {
  public readonly namespace?: string;
  public readonly id: string;
  public readonly name?: string;
  public readonly supportedRuntimePlatforms?: BuildRuntimePlatform[];
  public readonly inputProviders?: BuildStepInputProvider[];
  public readonly outputProviders?: BuildStepOutputProvider[];
  public readonly command?: string;
  public readonly fn?: BuildStepFunction;
  public readonly shell?: string;

  public static isFulldIdNamespaced(fullId: string): boolean {
    return fullId.includes('/');
  }

  constructor({
    namespace,
    id,
    name,
    supportedRuntimePlatforms,
    inputProviders,
    outputProviders,
    command,
    fn,
    shell,
  }: {
    namespace?: string;
    id: string;
    name?: string;
    supportedRuntimePlatforms?: BuildRuntimePlatform[];
    inputProviders?: BuildStepInputProvider[];
    outputProviders?: BuildStepOutputProvider[];
    command?: string;
    fn?: BuildStepFunction;
    shell?: string;
  }) {
    assert(command !== undefined || fn !== undefined, 'Either command or fn must be defined.');
    assert(!(command !== undefined && fn !== undefined), 'Command and fn cannot be both set.');

    this.namespace = namespace;
    this.id = id;
    this.name = name;
    this.supportedRuntimePlatforms = supportedRuntimePlatforms;
    this.inputProviders = inputProviders;
    this.outputProviders = outputProviders;
    this.command = command;
    this.fn = fn;
    this.shell = shell;
  }

  public getFullId(): string {
    return this.namespace === undefined ? this.id : `${this.namespace}/${this.id}`;
  }

  public createBuildStepFromFunctionCall(
    ctx: BuildStepContext,
    {
      id,
      name,
      callInputs = {},
      workingDirectory,
      shell,
    }: {
      id?: string;
      name?: string;
      callInputs?: BuildFunctionCallInputs;
      workingDirectory?: string;
      shell?: string;
    } = {}
  ): BuildStep {
    const buildStepId = BuildStep.getNewId(id);
    const buildStepName = name ?? this.name;
    const buildStepDisplayName = BuildStep.getDisplayName({
      id: buildStepId,
      command: this.command,
      name: buildStepName,
    });

    const inputs = this.inputProviders?.map((inputProvider) => {
      const input = inputProvider(ctx, buildStepId);
      if (input.id in callInputs) {
        input.set(callInputs[input.id]);
      }
      return input;
    });
    const outputs = this.outputProviders?.map((outputProvider) => outputProvider(ctx, buildStepId));

    return new BuildStep(ctx, {
      id: buildStepId,
      name: buildStepName,
      displayName: buildStepDisplayName,
      command: this.command,
      fn: this.fn,
      workingDirectory,
      inputs,
      outputs,
      shell,
      supportedRuntimePlatforms: this.supportedRuntimePlatforms,
    });
  }
}
