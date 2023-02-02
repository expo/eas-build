import path from 'path';
import fs from 'fs';

import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from '../BuildStepContext.js';

export async function saveScriptToTemporaryFileAsync(
  ctx: BuildStepContext,
  subdirectory: string,
  scriptContents: string
): Promise<string> {
  const scriptsDir = getTemporaryScriptsDirPath(ctx, subdirectory);
  await fs.promises.mkdir(scriptsDir, { recursive: true });
  const temporaryScriptPath = path.join(scriptsDir, `${uuidv4()}.sh`);
  await fs.promises.writeFile(temporaryScriptPath, scriptContents);
  return temporaryScriptPath;
}

// TODO: call this function somehow
export async function cleanUpTemporaryDirAsync(ctx: BuildStepContext): Promise<void> {
  const scriptsDir = getTemporaryScriptsDirPath(ctx);
  await fs.promises.rm(scriptsDir, { recursive: true });
  ctx.logger.debug(`Removed temporary directory "${scriptsDir}"`);
}

function getTemporaryScriptsDirPath(ctx: BuildStepContext, subdirectory?: string): string {
  const paths: string[] = [ctx.baseWorkingDirectory, 'scripts'];
  if (subdirectory) {
    paths.push(subdirectory);
  }
  return path.join(...paths);
}
