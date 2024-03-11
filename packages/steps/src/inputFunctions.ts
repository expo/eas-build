import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import fg from 'fast-glob';

import { BuildStepGlobalContext } from './BuildStepContext.js';

export async function hashFilesAsync(
  ctx: BuildStepGlobalContext,
  files: string[]
): Promise<string> {
  const hash = crypto.createHash('sha256');

  await Promise.all(
    files.map(async (file) => {
      let filePath = path.join(ctx.defaultWorkingDirectory, file);
      if (fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory()) {
        filePath += '/**/*';
      }
      const filePaths = await fg(filePath, { onlyFiles: true });
      return Promise.all(
        filePaths.map(async (filePath) => {
          const content = fs.readFileSync(filePath);
          ctx.baseLogger.debug(`Hashing file ${filePath}`);
          hash.update(path.relative(ctx.defaultWorkingDirectory, filePath));
          return hash.update(content);
        })
      );
    })
  );

  return hash.digest('hex');
}

export const hashFiles = hashFilesAsync;

export default async function callInputFunctionAsync(
  fnName: string,
  args: any[],
  ctx: BuildStepGlobalContext
): Promise<string> {
  switch (fnName) {
    case 'hashFiles':
      return await hashFilesAsync(ctx, args);
    default:
      throw new Error(`Unknown input function: ${fnName}`);
  }
}
