import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepInput, BuildStepInputById, makeBuildStepInputByIdMap } from './BuildStepInput.js';
import {
  BuildStepOutput,
  BuildStepOutputById,
  makeBuildStepOutputByIdMap,
} from './BuildStepOutput.js';
import { BIN_PATH } from './utils/shell/bin.js';
import { getDefaultShell, getShellCommandAndArgs } from './utils/shell/command.js';
import {
  cleanUpStepTemporaryDirectoriesAsync,
  createTemporaryOutputsDirectoryAsync,
  saveScriptToTemporaryFileAsync,
} from './BuildTemporaryFiles.js';
import { spawnAsync } from './utils/shell/spawn.js';
import { interpolateWithInputs } from './utils/template.js';
import { BuildStepRuntimeError } from './errors.js';
import { BuildStepEnv } from './BuildStepEnv.js';
import { BuildPlatform } from './BuildPlatform.js';

export enum BuildStepStatus {
  NEW = 'new',
  IN_PROGRESS = 'in-progress',
  CANCELED = 'canceled',
  FAIL = 'fail',
  WARNING = 'warning',
  SUCCESS = 'success',
}

export enum BuildStepLogMarker {
  START_STEP = 'start-step',
  END_STEP = 'end-step',
}

export type BuildStepFunction = (
  ctx: BuildStepContext,
  {
    inputs,
    outputs,
    env,
  }: { inputs: BuildStepInputById; outputs: BuildStepOutputById; env: BuildStepEnv }
) => unknown;

// TODO: move to a place common with tests
const UUID_REGEX =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;

export class BuildStep {
  public readonly id: string;
  public readonly name?: string;
  public readonly displayName: string;
  public readonly allowedPlatforms?: BuildPlatform[];
  public readonly inputs?: BuildStepInput[];
  public readonly outputs?: BuildStepOutput[];
  public readonly command?: string;
  public readonly fn?: BuildStepFunction;
  public readonly shell: string;
  public readonly ctx: BuildStepContext;
  public status: BuildStepStatus;

  private readonly internalId: string;
  private readonly inputById: BuildStepInputById;
  private readonly outputById: BuildStepOutputById;
  private executed = false;

  public static getNewId(userDefinedId?: string): string {
    return userDefinedId ?? uuidv4();
  }

  public static getDisplayName({
    id,
    name,
    command,
  }: {
    id: string;
    name?: string;
    command?: string;
  }): string {
    if (name) {
      return name;
    }
    if (!id.match(UUID_REGEX)) {
      return id;
    }
    if (command) {
      const splits = command.trim().split('\n');
      for (const split of splits) {
        const trimmed = split.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          return trimmed;
        }
      }
    }
    return id;
  }

  constructor(
    ctx: BuildStepContext,
    {
      id,
      name,
      displayName,
      inputs,
      outputs,
      command,
      fn,
      workingDirectory: maybeWorkingDirectory,
      shell,
      allowedPlatforms: maybeAllowedPlatforms,
    }: {
      id: string;
      name?: string;
      displayName: string;
      inputs?: BuildStepInput[];
      outputs?: BuildStepOutput[];
      command?: string;
      fn?: BuildStepFunction;
      workingDirectory?: string;
      shell?: string;
      allowedPlatforms?: BuildPlatform[];
    }
  ) {
    assert(command !== undefined || fn !== undefined, 'Either command or fn must be defined.');
    assert(!(command !== undefined && fn !== undefined), 'Command and fn cannot be both set.');

    this.id = id;
    this.name = name;
    this.displayName = displayName;
    this.allowedPlatforms = maybeAllowedPlatforms;
    this.inputs = inputs;
    this.outputs = outputs;
    this.inputById = makeBuildStepInputByIdMap(inputs);
    this.outputById = makeBuildStepOutputByIdMap(outputs);
    this.fn = fn;
    this.command = command;
    this.shell = shell ?? getDefaultShell();
    this.status = BuildStepStatus.NEW;

    this.internalId = uuidv4();

    const logger = ctx.logger.child({
      buildStepInternalId: this.internalId,
      buildStepId: this.id,
      buildStepDisplayName: this.displayName,
    });
    const workingDirectory =
      maybeWorkingDirectory !== undefined
        ? path.resolve(ctx.workingDirectory, maybeWorkingDirectory)
        : ctx.workingDirectory;
    this.ctx = ctx.child({ logger, workingDirectory });

    ctx.registerStep(this);
  }

  public async executeAsync(env: BuildStepEnv = process.env): Promise<void> {
    try {
      this.ctx.logger.info(
        { marker: BuildStepLogMarker.START_STEP },
        `Executing build step "${this.displayName}"`
      );
      this.status = BuildStepStatus.IN_PROGRESS;

      if (this.command !== undefined) {
        await this.executeCommandAsync(env);
      } else {
        await this.exectuteFnAsync(env);
      }

      this.ctx.logger.info(
        { marker: BuildStepLogMarker.END_STEP, result: BuildStepStatus.SUCCESS },
        `Finished build step "${this.displayName}" successfully`
      );
      this.status = BuildStepStatus.SUCCESS;
    } catch (err) {
      this.ctx.logger.error({ err });
      this.ctx.logger.error(
        { marker: BuildStepLogMarker.END_STEP, result: BuildStepStatus.FAIL },
        `Build step "${this.displayName}" failed`
      );
      this.status = BuildStepStatus.FAIL;
      throw err;
    } finally {
      this.executed = true;
    }
  }

  public hasOutputParameter(name: string): boolean {
    return name in this.outputById;
  }

  public getOutputValueByName(name: string): string | undefined {
    if (!this.executed) {
      throw new BuildStepRuntimeError(
        `Failed getting output "${name}" from step "${this.displayName}". The step has not been executed yet.`
      );
    }
    if (!this.hasOutputParameter(name)) {
      throw new BuildStepRuntimeError(`Step "${this.displayName}" does not have output "${name}".`);
    }
    return this.outputById[name].value;
  }

  public canBeRunOnRuntimePlatform(): boolean {
    return !this.allowedPlatforms || this.allowedPlatforms.includes(this.ctx.runtimePlatform);
  }

  private async executeCommandAsync(env: BuildStepEnv): Promise<void> {
    assert(this.command, 'Command must be defined.');

    try {
      const command = this.interpolateInputsInCommand(this.command, this.inputs);
      this.ctx.logger.debug(`Interpolated inputs in the command template`);

      const outputsDir = await createTemporaryOutputsDirectoryAsync(this.ctx, this.id);
      this.ctx.logger.debug(`Created temporary directory for step outputs: ${outputsDir}`);

      const scriptPath = await saveScriptToTemporaryFileAsync(this.ctx, this.id, command);
      this.ctx.logger.debug(`Saved script to ${scriptPath}`);

      const { command: shellCommand, args } = getShellCommandAndArgs(this.shell, scriptPath);
      this.ctx.logger.debug(
        `Executing script: ${shellCommand}${args !== undefined ? ` ${args.join(' ')}` : ''}`
      );
      await spawnAsync(shellCommand, args ?? [], {
        cwd: this.ctx.workingDirectory,
        logger: this.ctx.logger,
        env: this.getScriptEnv(env, outputsDir),
      });
      this.ctx.logger.debug(`Script completed successfully`);

      await this.collectAndValidateOutputsAsync(outputsDir);
      this.ctx.logger.debug('Finished collecting output paramters');
    } finally {
      await cleanUpStepTemporaryDirectoriesAsync(this.ctx, this.id);
    }
  }

  private async exectuteFnAsync(env: BuildStepEnv): Promise<void> {
    assert(this.fn, 'Function (fn) must be defined');

    await this.fn(this.ctx, { inputs: this.inputById, outputs: this.outputById, env });
  }

  private interpolateInputsInCommand(command: string, inputs?: BuildStepInput[]): string {
    if (!inputs) {
      return command;
    }
    const vars = inputs.reduce((acc, input) => {
      acc[input.id] = input.value ?? '';
      return acc;
    }, {} as Record<string, string>);
    return interpolateWithInputs(command, vars);
  }

  private async collectAndValidateOutputsAsync(outputsDir: string): Promise<void> {
    const files = await fs.readdir(outputsDir);

    const nonDefinedOutputIds: string[] = [];
    for (const outputId of files) {
      if (!(outputId in this.outputById)) {
        nonDefinedOutputIds.push(outputId);
      } else {
        const file = path.join(outputsDir, outputId);
        const rawContents = await fs.readFile(file, 'utf-8');
        const value = rawContents.trim();
        this.outputById[outputId].set(value);
      }
    }

    if (nonDefinedOutputIds.length > 0) {
      const idsString = nonDefinedOutputIds.map((i) => `"${i}"`).join(', ');
      this.ctx.logger.warn(`Some outputs are not defined in step config: ${idsString}`);
    }

    const nonSetRequiredOutputIds: string[] = [];
    for (const output of this.outputs ?? []) {
      try {
        const value = output.value;
        this.ctx.logger.debug(`Output parameter "${output.id}" is set to "${value}"`);
      } catch (err) {
        this.ctx.logger.debug({ err }, `Getting value for output parameter "${output.id}" failed.`);
        nonSetRequiredOutputIds.push(output.id);
      }
    }
    if (nonSetRequiredOutputIds.length > 0) {
      const idsString = nonSetRequiredOutputIds.map((i) => `"${i}"`).join(', ');
      throw new BuildStepRuntimeError(`Some required outputs have not been set: ${idsString}`, {
        metadata: { ids: nonSetRequiredOutputIds },
      });
    }
  }

  private getScriptEnv(env: BuildStepEnv, outputsDir: string): Record<string, string> {
    const currentPath = env.PATH ?? process.env.PATH;
    const newPath = currentPath ? `${BIN_PATH}:${currentPath}` : BIN_PATH;
    return {
      ...env,
      __EXPO_STEPS_BUILD_ID: this.ctx.buildId,
      __EXPO_STEPS_OUTPUTS_DIR: outputsDir,
      __EXPO_STEPS_WORKING_DIRECTORY: this.ctx.workingDirectory,
      PATH: newPath,
    };
  }
}
