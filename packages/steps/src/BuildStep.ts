import fs from 'fs';
import path from 'path';

import { bunyan } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepInput } from './BuildStepInput.js';
import { BuildStepOutput } from './BuildStepOutput.js';
import { BIN_PATH } from './utils/shell/bin.js';
import { getDefaultShell, getShellCommandAndArgs } from './utils/shell/command.js';
import {
  cleanUpStepTemporaryDirectoriesAsync,
  createTemporaryOutputsDirectoryAsync,
  saveScriptToTemporaryFileAsync,
} from './BuildTemporaryFiles.js';
import { spawnAsync } from './utils/shell/spawn.js';
import { interpolateWithInputs } from './utils/template.js';
import { BuildStepRuntimeError } from './errors/BuildStepRuntimeError.js';
import { BuildStepEnv } from './BuildStepEnv.js';

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

export class BuildStep {
  public readonly id: string;
  public readonly name?: string;
  public readonly displayName?: string;
  public readonly inputs?: BuildStepInput[];
  public readonly outputs?: BuildStepOutput[];
  public readonly command: string;
  public readonly workingDirectory: string;
  public readonly shell: string;
  public status: BuildStepStatus;

  private readonly internalId: string;
  private readonly logger: bunyan;
  private readonly outputById: Record<string, BuildStepOutput>;
  private executed = false;

  constructor(
    private readonly ctx: BuildStepContext,
    {
      id,
      name,
      inputs,
      outputs,
      command,
      workingDirectory,
      shell,
    }: {
      id: string;
      name?: string;
      inputs?: BuildStepInput[];
      outputs?: BuildStepOutput[];
      command: string;
      workingDirectory: string;
      shell?: string;
    }
  ) {
    this.id = id;
    this.name = name;
    this.displayName = this.getStepDisplayName(name, command);
    this.inputs = inputs;
    this.outputs = outputs;
    this.outputById =
      outputs === undefined
        ? {}
        : outputs.reduce((acc, output) => {
            acc[output.id] = output;
            return acc;
          }, {} as Record<string, BuildStepOutput>);
    this.command = command;
    this.workingDirectory = workingDirectory;
    this.shell = shell ?? getDefaultShell();
    this.status = BuildStepStatus.NEW;

    this.internalId = uuidv4();
    this.logger = ctx.logger.child({
      buildStepInternalId: this.internalId,
      buildStepId: this.id,
      buildStepDisplayName: this.displayName,
    });

    ctx.registerStep(this);
  }

  public async executeAsync(env: BuildStepEnv = process.env): Promise<void> {
    try {
      this.logger.info(
        { marker: BuildStepLogMarker.START_STEP },
        `Executing build step "${this.id}"`
      );
      this.status = BuildStepStatus.IN_PROGRESS;

      const command = this.interpolateInputsInCommand(this.command, this.inputs);
      this.logger.debug(`Interpolated inputs in the command template`);

      const outputsDir = await createTemporaryOutputsDirectoryAsync(this.ctx, this.id);
      this.logger.debug(`Created temporary directory for step outputs: ${outputsDir}`);

      const scriptPath = await saveScriptToTemporaryFileAsync(this.ctx, this.id, command);
      this.logger.debug(`Saved script to ${scriptPath}`);

      const { command: shellCommand, args } = getShellCommandAndArgs(this.shell, scriptPath);
      this.logger.debug(
        `Executing script: ${shellCommand}${args !== undefined ? ` ${args.join(' ')}` : ''}`
      );
      await spawnAsync(shellCommand, args ?? [], {
        cwd: this.workingDirectory,
        logger: this.logger,
        env: this.getScriptEnv(env, outputsDir),
      });
      this.logger.debug(`Script completed successfully`);

      await this.collectAndValidateOutputsAsync(outputsDir);
      this.logger.debug('Finished collecting output paramters');

      this.logger.info(
        { marker: BuildStepLogMarker.END_STEP, result: BuildStepStatus.SUCCESS },
        `Finished build step "${this.id}" successfully`
      );
      this.status = BuildStepStatus.SUCCESS;
    } catch (err) {
      this.logger.error({ err });
      this.logger.error(
        { marker: BuildStepLogMarker.END_STEP, result: BuildStepStatus.FAIL },
        `Build step "${this.id}" failed`
      );
      this.status = BuildStepStatus.FAIL;
      throw err;
    } finally {
      this.executed = true;
      await cleanUpStepTemporaryDirectoriesAsync(this.ctx, this.id);
    }
  }

  public hasOutputParameter(name: string): boolean {
    return name in this.outputById;
  }

  public getOutputValueByName(name: string): string | undefined {
    if (!this.executed) {
      throw new BuildStepRuntimeError(
        `Failed getting output "${name}" from step "${this.id}". The step has not been executed yet.`
      );
    }
    if (!this.hasOutputParameter(name)) {
      throw new BuildStepRuntimeError(`Step "${this.id}" does not have output "${name}"`);
    }
    return this.outputById[name].value;
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
    const files = await fs.promises.readdir(outputsDir);

    const nonDefinedOutputIds: string[] = [];
    for (const outputId of files) {
      if (!(outputId in this.outputById)) {
        nonDefinedOutputIds.push(outputId);
      } else {
        const file = path.join(outputsDir, outputId);
        const rawContents = await fs.promises.readFile(file, 'utf-8');
        const value = rawContents.trim();
        this.outputById[outputId].set(value);
      }
    }

    if (nonDefinedOutputIds.length > 0) {
      const idsString = nonDefinedOutputIds.map((i) => `"${i}"`).join(', ');
      this.logger.warn(`Some outputs are not defined in step config: ${idsString}`);
    }

    const nonSetRequiredOutputIds: string[] = [];
    for (const output of this.outputs ?? []) {
      try {
        const value = output.value;
        this.logger.debug(`Output parameter "${output.id}" is set to "${value}"`);
      } catch (err) {
        this.logger.debug({ err }, `Getting value for output parameter "${output.id}" failed.`);
        nonSetRequiredOutputIds.push(output.id);
      }
    }
    if (nonSetRequiredOutputIds.length > 0) {
      const idsString = nonSetRequiredOutputIds.map((i) => `"${i}"`).join(', ');
      throw new BuildStepRuntimeError(
        `Some required output parameters have not been set: ${idsString}`,
        { metadata: { ids: nonSetRequiredOutputIds } }
      );
    }
  }

  private getScriptEnv(env: BuildStepEnv, outputsDir: string): Record<string, string> {
    const currentPath = env.PATH ?? process.env.PATH;
    const newPath = currentPath ? `${BIN_PATH}:${currentPath}` : BIN_PATH;
    return {
      ...env,
      __EXPO_STEPS_OUTPUTS_DIR: outputsDir,
      PATH: newPath,
    };
  }

  private getStepDisplayName(name: string | undefined, command: string): string | undefined {
    if (name) {
      return name;
    }
    if (command !== '') {
      const splits = command.trim().split('\n');
      for (const split of splits) {
        const trimmed = split.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          return trimmed;
        }
      }
    }
    return undefined;
  }
}
