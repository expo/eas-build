import assert from 'assert';

import { BuildRuntimePlatform } from './BuildRuntimePlatform.js';
import { BuildStep, BuildStepFunction } from './BuildStep.js';
import { BuildStepGlobalContext } from './BuildStepContext.js';
import { BuildStepInputProvider, BuildStepInputValueType } from './BuildStepInput.js';
import { BuildStepOutputProvider } from './BuildStepOutput.js';
import { BuildStepEnv } from './BuildStepEnv.js';
import { createCustomFunctionCall } from './utils/customFunction.js';

export type BuildFunctionById = Record<string, BuildFunction>;
export type BuildFunctionCallInputs = Record<string, BuildStepInputValueType>;

export class BuildFunction {
  public readonly namespace?: string;
  public readonly id: string;
  public readonly name?: string;
  public readonly supportedRuntimePlatforms?: BuildRuntimePlatform[];
  public readonly inputProviders?: BuildStepInputProvider[];
  public readonly outputProviders?: BuildStepOutputProvider[];
  public readonly command?: string;
  public readonly customFunctionModulePath?: string;
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
    path,
    shell,
  }: {
    namespace?: string;
    id: string;
    name?: string;
    supportedRuntimePlatforms?: BuildRuntimePlatform[];
    inputProviders?: BuildStepInputProvider[];
    outputProviders?: BuildStepOutputProvider[];
    command?: string;
    path?: string;
    fn?: BuildStepFunction;
    shell?: string;
  }) {
    assert(
      command !== undefined || fn !== undefined || path !== undefined,
      'Either command, fn or path must be defined.'
    );

    assert(!(command !== undefined && fn !== undefined), 'Command and fn cannot be both set.');
    assert(!(command !== undefined && path !== undefined), 'Command and path cannot be both set.');
    assert(!(fn !== undefined && path !== undefined), 'Fn and path cannot be both set.');

    this.namespace = namespace;
    this.id = id;
    this.name = name;
    this.supportedRuntimePlatforms = supportedRuntimePlatforms;
    this.inputProviders = inputProviders;
    this.outputProviders = outputProviders;
    this.command = command;
    this.fn = fn;
    this.shell = shell;
    this.customFunctionModulePath = path;
  }

  public getFullId(): string {
    return this.namespace === undefined ? this.id : `${this.namespace}/${this.id}`;
  }

  public createBuildStepFromFunctionCall(
    ctx: BuildStepGlobalContext,
    {
      id,
      name,
      callInputs = {},
      workingDirectory,
      shell,
      env,
    }: {
      id?: string;
      name?: string;
      callInputs?: BuildFunctionCallInputs;
      workingDirectory?: string;
      shell?: string;
      env?: BuildStepEnv;
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
      fn: this.fn ?? createCustomFunctionCall(this.customFunctionModulePath),
      workingDirectory,
      inputs,
      outputs,
      shell,
      supportedRuntimePlatforms: this.supportedRuntimePlatforms,
      env,
    });
  }
}
