import { bunyan } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from './BuildStepContext.js';
import { getDefaultShell, getShellCommandAndArgs } from './shell/command.js';
import { saveScriptToTemporaryFileAsync } from './shell/scripts.js';
import { spawnAsync } from './shell/spawn.js';

export class BuildStep {
  public id: string;
  public name?: string;
  public command: string;
  public workingDirectory: string;
  public shell: string;

  private readonly internalId: string;
  private readonly logger: bunyan;

  constructor(
    private readonly ctx: BuildStepContext,
    {
      id,
      name,
      command,
      workingDirectory,
      shell,
    }: {
      id: string;
      name?: string;
      command: string;
      workingDirectory: string;
      shell?: string;
    }
  ) {
    this.id = id;
    this.name = name;
    this.command = command;
    this.workingDirectory = workingDirectory;
    this.shell = shell ?? getDefaultShell();

    this.internalId = uuidv4();
    this.logger = ctx.logger.child({ buildStepInternalId: this.internalId, buildStepId: this.id });
  }

  public async executeAsync(): Promise<void> {
    this.logger.debug(`Executing build step "${this.id}"`);
    const scriptPath = await saveScriptToTemporaryFileAsync(this.ctx, this.id, this.command);
    this.logger.debug(`Saved script to ${scriptPath}`);
    const { command, args } = getShellCommandAndArgs(this.shell, scriptPath);
    this.logger.debug(
      `Executing script: ${command}${args !== undefined ? ` ${args.join(' ')}` : ''}`
    );
    await spawnAsync(command, args ?? [], {
      cwd: this.workingDirectory,
      logger: this.logger,
    });
  }
}
