import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext, BuildStepGlobalContext } from './BuildStepContext.js';
import { BuildStepInput, BuildStepInputById, makeBuildStepInputByIdMap } from './BuildStepInput.js';
import {
  BuildStepOutput,
  BuildStepOutputById,
  SerializedBuildStepOutput,
  makeBuildStepOutputByIdMap,
} from './BuildStepOutput.js';
import { BIN_PATH } from './utils/shell/bin.js';
import { getDefaultShell, getShellCommandAndArgs } from './utils/shell/command.js';
import {
  cleanUpStepTemporaryDirectoriesAsync,
  getTemporaryEnvsDirPath,
  getTemporaryOutputsDirPath,
  saveScriptToTemporaryFileAsync,
} from './BuildTemporaryFiles.js';
import { spawnAsync } from './utils/shell/spawn.js';
import { interpolateWithInputs, interpolateWithOutputs } from './utils/template.js';
import { BuildStepRuntimeError } from './errors.js';
import { BuildStepEnv } from './BuildStepEnv.js';
import { BuildRuntimePlatform } from './BuildRuntimePlatform.js';
import { jsepEval } from './utils/jsepEval.js';

export enum BuildStepStatus {
  NEW = 'new',
  IN_PROGRESS = 'in-progress',
  SKIPPED = 'skipped',
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

export interface SerializedBuildStepOutputAccessor {
  id: string;
  executed: boolean;
  outputById: Record<string, SerializedBuildStepOutput>;
  displayName: string;
}

export class BuildStepOutputAccessor {
  constructor(
    public readonly id: string,
    public readonly displayName: string,
    protected readonly executed: boolean,
    protected readonly outputById: BuildStepOutputById
  ) {}

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

  public hasOutputParameter(name: string): boolean {
    return name in this.outputById;
  }

  public serialize(): SerializedBuildStepOutputAccessor {
    return {
      id: this.id,
      executed: this.executed,
      outputById: Object.fromEntries(
        Object.entries(this.outputById).map(([key, value]) => [key, value.serialize()])
      ),
      displayName: this.displayName,
    };
  }

  public static deserialize(
    serialized: SerializedBuildStepOutputAccessor
  ): BuildStepOutputAccessor {
    const outputById = Object.fromEntries(
      Object.entries(serialized.outputById).map(([key, value]) => [
        key,
        BuildStepOutput.deserialize(value),
      ])
    );
    return new BuildStepOutputAccessor(
      serialized.id,
      serialized.displayName,
      serialized.executed,
      outputById
    );
  }
}

export class BuildStep extends BuildStepOutputAccessor {
  public readonly id: string;
  public readonly name?: string;
  public readonly displayName: string;
  public readonly supportedRuntimePlatforms?: BuildRuntimePlatform[];
  public readonly inputs?: BuildStepInput[];
  public readonly outputById: BuildStepOutputById;
  public readonly command?: string;
  public readonly fn?: BuildStepFunction;
  public readonly shell: string;
  public readonly ctx: BuildStepContext;
  public readonly stepEnvOverrides: BuildStepEnv;
  public readonly ifCondition?: string;
  public status: BuildStepStatus;
  private readonly outputsDir: string;
  private readonly envsDir: string;

  private readonly internalId: string;
  private readonly inputById: BuildStepInputById;
  protected executed = false;

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
      ifCondition,
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
      ifCondition?: string;
    }
  ) {
    assert(command !== undefined || fn !== undefined, 'Either command or fn must be defined.');
    assert(!(command !== undefined && fn !== undefined), 'Command and fn cannot be both set.');
    const outputById = makeBuildStepOutputByIdMap(outputs);
    super(id, displayName, false, outputById);

    this.id = id;
    this.name = name;
    this.displayName = displayName;
    this.supportedRuntimePlatforms = maybeSupportedRuntimePlatforms;
    this.inputs = inputs;
    this.inputById = makeBuildStepInputByIdMap(inputs);
    this.outputById = outputById;
    this.fn = fn;
    this.command = command;
    this.shell = shell ?? getDefaultShell();
    this.ifCondition = ifCondition;
    this.status = BuildStepStatus.NEW;

    this.internalId = uuidv4();

    const logger = ctx.baseLogger.child({
      buildStepInternalId: this.internalId,
      buildStepId: this.id,
      buildStepDisplayName: this.displayName,
    });
    this.ctx = ctx.stepCtx({ logger, relativeWorkingDirectory: maybeWorkingDirectory });
    this.stepEnvOverrides = env ?? {};

    this.outputsDir = getTemporaryOutputsDirPath(ctx, this.id);
    this.envsDir = getTemporaryEnvsDirPath(ctx, this.id);

    ctx.registerStep(this);
  }

  public async executeAsync(): Promise<void> {
    try {
      this.ctx.logger.info(
        { marker: BuildStepLogMarker.START_STEP },
        `Executing build step "${this.displayName}"`
      );
      this.status = BuildStepStatus.IN_PROGRESS;

      await fs.mkdir(this.outputsDir, { recursive: true });
      this.ctx.logger.debug(`Created temporary directory for step outputs: ${this.outputsDir}`);

      await fs.mkdir(this.envsDir, { recursive: true });
      this.ctx.logger.debug(
        `Created temporary directory for step environment variables: ${this.envsDir}`
      );

      if (this.command !== undefined) {
        await this.executeCommandAsync();
      } else {
        await this.executeFnAsync();
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

      try {
        await this.collectAndValidateOutputsAsync(this.outputsDir);
        await this.collectAndUpdateEnvsAsync(this.envsDir);
        this.ctx.logger.debug('Finished collecting output parameters');
      } catch (error) {
        // If the step succeeded, we expect the outputs to be collected successfully.
        if (this.status === BuildStepStatus.SUCCESS) {
          throw error;
        }

        this.ctx.logger.debug({ err: error }, 'Failed to collect output parameters');
      }

      await cleanUpStepTemporaryDirectoriesAsync(this.ctx.global, this.id);
    }
  }

  public canBeRunOnRuntimePlatform(): boolean {
    return (
      !this.supportedRuntimePlatforms ||
      this.supportedRuntimePlatforms.includes(this.ctx.global.runtimePlatform)
    );
  }

  public shouldExecuteStep(hasAnyPreviousStepsFailed: boolean): boolean {
    if (!this.ifCondition) {
      return !hasAnyPreviousStepsFailed;
    }

    let ifCondition = this.ifCondition;

    if (ifCondition.startsWith('${') && ifCondition.endsWith('}')) {
      ifCondition = ifCondition.slice(2, -1);
    }

    return Boolean(
      jsepEval(ifCondition, {
        success: () => !hasAnyPreviousStepsFailed,
        failure: () => hasAnyPreviousStepsFailed,
        always: () => true,
        never: () => false,
        env: this.getScriptEnv(),
        inputs:
          this.inputs?.reduce(
            (acc, input) => {
              acc[input.id] = input.value;
              return acc;
            },
            {} as Record<string, unknown>
          ) ?? {},
        eas: {
          runtimePlatform: this.ctx.global.runtimePlatform,
          ...this.ctx.global.staticContext,
        },
      })
    );
  }

  public skip(): void {
    this.status = BuildStepStatus.SKIPPED;
    this.ctx.logger.info(
      { marker: BuildStepLogMarker.START_STEP },
      'Executing build step "${this.displayName}"'
    );
    this.ctx.logger.info(`Skipped build step "${this.displayName}"`);
    this.ctx.logger.info(
      { marker: BuildStepLogMarker.END_STEP, result: BuildStepStatus.SKIPPED },
      `Skipped build step "${this.displayName}"`
    );
  }

  private async executeCommandAsync(): Promise<void> {
    assert(this.command, 'Command must be defined.');

    const command = this.interpolateInputsOutputsAndGlobalContextInTemplate(
      this.command,
      this.inputs
    );
    this.ctx.logger.debug(`Interpolated inputs in the command template`);

    const scriptPath = await saveScriptToTemporaryFileAsync(this.ctx.global, this.id, command);
    this.ctx.logger.debug(`Saved script to ${scriptPath}`);

    const { command: shellCommand, args } = getShellCommandAndArgs(this.shell, scriptPath);
    this.ctx.logger.debug(
      `Executing script: ${shellCommand}${args !== undefined ? ` ${args.join(' ')}` : ''}`
    );
    await spawnAsync(shellCommand, args ?? [], {
      cwd: this.ctx.workingDirectory,
      logger: this.ctx.logger,
      env: this.getScriptEnv(),
      // stdin is /dev/null, std{out,err} are piped into logger.
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.ctx.logger.debug(`Script completed successfully`);
  }

  private async executeFnAsync(): Promise<void> {
    assert(this.fn, 'Function (fn) must be defined');

    await this.fn(this.ctx, {
      inputs: this.inputById,
      outputs: this.outputById,
      env: this.getScriptEnv(),
    });

    this.ctx.logger.debug(`Script completed successfully`);
  }

  private interpolateInputsOutputsAndGlobalContextInTemplate(
    template: string,
    inputs?: BuildStepInput[]
  ): string {
    if (!inputs) {
      return interpolateWithOutputs(
        this.ctx.global.interpolate(template),
        (path) => this.ctx.global.getStepOutputValue(path) ?? ''
      );
    }
    const vars = inputs.reduce(
      (acc, input) => {
        acc[input.id] =
          typeof input.value === 'object'
            ? JSON.stringify(input.value)
            : input.value?.toString() ?? '';
        return acc;
      },
      {} as Record<string, string>
    );
    return interpolateWithOutputs(
      interpolateWithInputs(this.ctx.global.interpolate(template), vars),
      (path) => this.ctx.global.getStepOutputValue(path) ?? ''
    );
  }

  private async collectAndValidateOutputsAsync(outputsDir: string): Promise<void> {
    const files = await fs.readdir(outputsDir);

    const nonDefinedOutputIds: string[] = [];
    for (const outputId of files) {
      if (!(outputId in this.outputById)) {
        nonDefinedOutputIds.push(outputId);
        const newOutput = new BuildStepOutput(this.ctx.global, {
          id: outputId,
          stepDisplayName: this.displayName,
          required: false,
        });
        const file = path.join(outputsDir, outputId);
        const rawContents = await fs.readFile(file, 'utf-8');
        const value = rawContents.trim();
        newOutput.set(value);
        this.outputById[outputId] = newOutput;
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
    for (const output of Object.values(this.outputById)) {
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

  private getScriptEnv(): Record<string, string> {
    const effectiveEnv = { ...this.ctx.global.env, ...this.stepEnvOverrides };
    const currentPath = effectiveEnv.PATH ?? process.env.PATH;
    const newPath = currentPath ? `${BIN_PATH}:${currentPath}` : BIN_PATH;
    return {
      ...effectiveEnv,
      __EXPO_STEPS_OUTPUTS_DIR: this.outputsDir,
      __EXPO_STEPS_ENVS_DIR: this.envsDir,
      __EXPO_STEPS_WORKING_DIRECTORY: this.ctx.workingDirectory,
      PATH: newPath,
    };
  }
}
