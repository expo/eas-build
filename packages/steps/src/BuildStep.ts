import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext, BuildStepGlobalContext } from './BuildStepContext.js';
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
  createTemporaryEnvsDirectoryAsync,
  createTemporaryOutputsDirectoryAsync,
  saveScriptToTemporaryFileAsync,
} from './BuildTemporaryFiles.js';
import { spawnAsync } from './utils/shell/spawn.js';
import { interpolateWithInputs } from './utils/template.js';
import { BuildStepRuntimeError } from './errors.js';
import { BuildStepEnv } from './BuildStepEnv.js';
import { BuildRuntimePlatform } from './BuildRuntimePlatform.js';

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
  public readonly supportedRuntimePlatforms?: BuildRuntimePlatform[];
  public readonly inputs?: BuildStepInput[];
  public readonly outputs?: BuildStepOutput[];
  public readonly command?: string;
  public readonly fn?: BuildStepFunction;
  public readonly shell: string;
  public readonly ctx: BuildStepContext;
  public readonly env: BuildStepEnv;
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
    ctx: BuildStepGlobalContext,
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
      supportedRuntimePlatforms: maybeSupportedRuntimePlatforms,
      env,
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
      supportedRuntimePlatforms?: BuildRuntimePlatform[];
      env?: BuildStepEnv;
    }
  ) {
    assert(command !== undefined || fn !== undefined, 'Either command or fn must be defined.');
    assert(!(command !== undefined && fn !== undefined), 'Command and fn cannot be both set.');

    this.id = id;
    this.name = name;
    this.displayName = displayName;
    this.supportedRuntimePlatforms = maybeSupportedRuntimePlatforms;
    this.inputs = inputs;
    this.outputs = outputs;
    this.inputById = makeBuildStepInputByIdMap(inputs);
    this.outputById = makeBuildStepOutputByIdMap(outputs);
    this.fn = fn;
    this.command = command;
    this.shell = shell ?? getDefaultShell();
    this.status = BuildStepStatus.NEW;

    this.internalId = uuidv4();

    const logger = ctx.baseLogger.child({
      buildStepInternalId: this.internalId,
      buildStepId: this.id,
      buildStepDisplayName: this.displayName,
    });
    const workingDirectory =
      maybeWorkingDirectory !== undefined
        ? path.resolve(ctx.defaultWorkingDirectory, maybeWorkingDirectory)
        : ctx.defaultWorkingDirectory;
    this.ctx = ctx.stepCtx({ logger, workingDirectory });
    this.env = env ?? {};

    ctx.registerStep(this);
  }

  public async executeAsync(): Promise<void> {
    try {
      this.ctx.logger.info(
        { marker: BuildStepLogMarker.START_STEP },
        `Executing build step "${this.displayName}"`
      );
      this.status = BuildStepStatus.IN_PROGRESS;

      if (this.command !== undefined) {
        await this.executeCommandAsync();
      } else {
        await this.exectuteFnAsync();
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
    return (
      !this.supportedRuntimePlatforms ||
      this.supportedRuntimePlatforms.includes(this.ctx.global.runtimePlatform)
    );
  }

  private async executeCommandAsync(): Promise<void> {
    assert(this.command, 'Command must be defined.');

    try {
      const command = this.interpolateInputsAndGlobalContextInCommand(this.command, this.inputs);
      this.ctx.logger.debug(`Interpolated inputs in the command template`);

      const outputsDir = await createTemporaryOutputsDirectoryAsync(this.ctx.global, this.id);
      this.ctx.logger.debug(`Created temporary directory for step outputs: ${outputsDir}`);

      const envsDir = await createTemporaryEnvsDirectoryAsync(this.ctx.global, this.id);
      this.ctx.logger.debug(
        `Created temporary directory for step environment variables: ${outputsDir}`
      );

      const scriptPath = await saveScriptToTemporaryFileAsync(this.ctx.global, this.id, command);
      this.ctx.logger.debug(`Saved script to ${scriptPath}`);

      const { command: shellCommand, args } = getShellCommandAndArgs(this.shell, scriptPath);
      this.ctx.logger.debug(
        `Executing script: ${shellCommand}${args !== undefined ? ` ${args.join(' ')}` : ''}`
      );
      await spawnAsync(shellCommand, args ?? [], {
        cwd: this.ctx.workingDirectory,
        logger: this.ctx.logger,
        env: this.getScriptEnv({ outputsDir, envsDir }),
      });
      this.ctx.logger.debug(`Script completed successfully`);

      await this.collectAndValidateOutputsAsync(outputsDir);
      await this.collectAndUpdateEnvsAsync(envsDir);
      this.ctx.logger.debug('Finished collecting output paramters');
    } finally {
      await cleanUpStepTemporaryDirectoriesAsync(this.ctx.global, this.id);
    }
  }

  private async exectuteFnAsync(): Promise<void> {
    assert(this.fn, 'Function (fn) must be defined');

    await this.fn(this.ctx, {
      inputs: this.inputById,
      outputs: this.outputById,
      env: {
        ...this.ctx.global.env,
        ...this.env,
      },
    });
  }

  private interpolateInputsAndGlobalContextInCommand(
    command: string,
    inputs?: BuildStepInput[]
  ): string {
    if (!inputs) {
      return command;
    }
    const vars = inputs.reduce((acc, input) => {
      acc[input.id] =
        typeof input.value === 'object'
          ? JSON.stringify(input.value)
          : input.value?.toString() ?? '';
      return acc;
    }, {} as Record<string, string>);
    const valueInterpolatedWithGlobalContext = this.ctx.global.interpolate(command);
    return interpolateWithInputs(valueInterpolatedWithGlobalContext, vars);
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

  private async collectAndUpdateEnvsAsync(envsDir: string): Promise<void> {
    const filenames = await fs.readdir(envsDir);

    const entries = await Promise.all(
      filenames.map(async (basename) => {
        const rawContents = await fs.readFile(path.join(envsDir, basename), 'utf-8');
        return [basename, rawContents];
      })
    );
    this.ctx.global.updateEnv({
      ...this.ctx.global.env,
      ...Object.fromEntries(entries),
    });
  }

  private getScriptEnv({
    envsDir,
    outputsDir,
  }: {
    envsDir: string;
    outputsDir: string;
  }): Record<string, string> {
    const env = { ...this.ctx.global.env, ...this.env };
    const currentPath = env.PATH ?? process.env.PATH;
    const newPath = currentPath ? `${BIN_PATH}:${currentPath}` : BIN_PATH;
    return {
      ...env,
      __EXPO_STEPS_OUTPUTS_DIR: outputsDir,
      __EXPO_STEPS_ENVS_DIR: envsDir,
      __EXPO_STEPS_WORKING_DIRECTORY: this.ctx.workingDirectory,
      PATH: newPath,
    };
  }
}
