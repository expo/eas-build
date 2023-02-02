import path from 'path';
import fs from 'fs';

import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from '../../BuildStepContext.js';

export async function saveScriptToTemporaryFileAsync(
  ctx: BuildStepContext,
  stepId: string,
  scriptContents: string
): Promise<string> {
  const scriptsDir = getTemporaryScriptsDirPath(ctx, stepId);
  await fs.promises.mkdir(scriptsDir, { recursive: true });
  const temporaryScriptPath = path.join(scriptsDir, `${uuidv4()}.sh`);
  await fs.promises.writeFile(temporaryScriptPath, scriptContents);
  return temporaryScriptPath;
}

export async function createTemporaryOutputsDirectoryAsync(
  ctx: BuildStepContext,
  stepId: string
): Promise<string> {
  const directory = getTemporaryOutputsDirPath(ctx, stepId);
  await fs.promises.mkdir(directory, { recursive: true });
  return directory;
}

export async function cleanUpTemporaryDirectoriesAsync(
  ctx: BuildStepContext,
  stepId: string
): Promise<void> {
  if (ctx.skipCleanup) {
    return;
  }
  const stepTemporaryDirectory = getTemporaryStepDirPath(ctx, stepId);
  await fs.promises.rm(stepTemporaryDirectory, { recursive: true });
  ctx.logger.debug({ stepTemporaryDirectory }, 'Removed step temporary directory');
}

function getTemporaryStepDirPath(ctx: BuildStepContext, stepId: string): string {
  return path.join(ctx.baseWorkingDirectory, 'steps', stepId);
}

function getTemporaryScriptsDirPath(ctx: BuildStepContext, stepId: string): string {
  return path.join(getTemporaryStepDirPath(ctx, stepId), 'scripts');
}

function getTemporaryOutputsDirPath(ctx: BuildStepContext, stepId: string): string {
  return path.join(getTemporaryStepDirPath(ctx, stepId), 'outputs');
}
