import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import fg from 'fast-glob';

import { BuildStepGlobalContext } from './BuildStepContext.js';
import { jsepEval } from './utils/jsepEval.js';

async function hashFilesAsync(ctx: BuildStepGlobalContext, ...files: string[]): Promise<string> {
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

function _getFunctions(ctx?: BuildStepGlobalContext): Record<string, (...args: any) => any> {
  return {
    hashFiles: (...args: any) => ctx && hashFilesAsync(ctx, ...args),
  };
}

// Returns noop list of functions for evaluation by jsep.
function getFunctionsForValidation(): Record<string, (...args: any) => any> {
  return _getFunctions();
}

function getFunctions(ctx: BuildStepGlobalContext): Record<string, (...args: any) => any> {
  return _getFunctions(ctx);
}

export function validateInputFunction(templateFunction: string): string {
  return jsepEval(templateFunction, getFunctionsForValidation());
}

export default async function callInputFunctionAsync(
  templateFunction: string,
  ctx: BuildStepGlobalContext
): Promise<string> {
  return jsepEval(templateFunction, getFunctions(ctx));
}
