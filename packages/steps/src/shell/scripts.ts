import path from 'path';
import fs from 'fs';

import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from '../BuildStepContext.js';

export async function saveScriptToTemporaryFileAsync(
  ctx: BuildStepContext,
  pathPrefix: string,
  script: string
): Promise<string> {
  const scriptsDir = getTemporaryScriptsDirPath(ctx, pathPrefix);
  await fs.promises.mkdir(scriptsDir, { recursive: true });
  const temporaryScriptPath = path.join(scriptsDir, `${uuidv4()}.sh`);
  await fs.promises.writeFile(temporaryScriptPath, script);
  return temporaryScriptPath;
}

// TODO: call this function somehow
export async function cleanUpTemporaryDirAsync(ctx: BuildStepContext): Promise<void> {
  const scriptsDir = getTemporaryScriptsDirPath(ctx);
  await fs.promises.rm(scriptsDir, { recursive: true });
  ctx.logger.debug(`Removed temporary directory "${scriptsDir}"`);
}

function getTemporaryScriptsDirPath(ctx: BuildStepContext, pathPrefix?: string): string {
  const paths: string[] = [ctx.baseWorkingDirectory, 'scripts'];
  if (pathPrefix) {
    paths.push(pathPrefix);
  }
  return path.join(...paths);
}
