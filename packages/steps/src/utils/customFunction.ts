import path from 'path';
import assert from 'assert';

import { createContext } from 'this-file';
import { resolvePackageManager } from '@expo/package-manager';

import { BuildStepFunction } from '../BuildStep.js';
import { BuildStepEnv } from '../BuildStepEnv.js';
import { SerializedBuildStepInput } from '../BuildStepInput.js';
import { SerializedBuildStepOutput } from '../BuildStepOutput.js';
import { SerializedBuildStepContext } from '../BuildStepContext.js';
import { BuildFunction } from '../BuildFunction.js';

import { spawnAsync } from './shell/spawn.js';

const thisFileCtx = createContext();

export const SCRIPTS_PATH = path.join(thisFileCtx.dirname, '../../dist_commonjs/scripts');

export interface SerializedCustomBuildFunctionArguments {
  env: BuildStepEnv;
  inputs: Record<string, SerializedBuildStepInput>;
  outputs: Record<string, SerializedBuildStepOutput>;
  ctx: SerializedBuildStepContext;
}

export function createCustomFunctionCall(customFunctionModulePath: string): BuildStepFunction {
  return async (ctx, { env, inputs, outputs }) => {
    const serializedArguments: SerializedCustomBuildFunctionArguments = {
      env,
      inputs: Object.fromEntries(
        Object.entries(inputs).map(([id, input]) => [id, input.serialize()])
      ),
      outputs: Object.fromEntries(
        Object.entries(outputs).map(([id, output]) => [id, output.serialize()])
      ),
      ctx: ctx.serialize(),
    };
    await spawnAsync(
      'node',
      [
        path.join(SCRIPTS_PATH, 'runCustomFunction.cjs'),
        customFunctionModulePath,
        JSON.stringify(serializedArguments),
      ],
      {
        logger: ctx.logger,
        cwd: ctx.workingDirectory,
        env,
      }
    );
  };
}

export const INSTALL_DEPENDENCIES_AND_COMPILE_CUSTOM_FUNCTION_MODULES_ID =
  'install_dependencies_and_compile_custom_function_modules';
export const INSTALL_DEPENDENCIES_AND_COMPILE_CUSTOM_FUNCTION_MODULES_NAMESPACE = 'internal';
export const INSTALL_DEPENDENCIES_AND_COMPILE_CUSTOM_FUNCTION_MODULES_NAME =
  'Install dependencies and compile custom function modules';

export function createBuildFunctionToInstallDependenciesAndCompileCustomFunctionModules(
  customFunctions: BuildFunction[]
): BuildFunction {
  return new BuildFunction({
    namespace: INSTALL_DEPENDENCIES_AND_COMPILE_CUSTOM_FUNCTION_MODULES_NAMESPACE,
    id: INSTALL_DEPENDENCIES_AND_COMPILE_CUSTOM_FUNCTION_MODULES_ID,
    name: INSTALL_DEPENDENCIES_AND_COMPILE_CUSTOM_FUNCTION_MODULES_NAME,
    // eslint-disable-next-line async-protect/async-suffix
    fn: async (ctx, { env }) => {
      for (const customFunction of customFunctions) {
        assert(customFunction.customFunctionModulePath, 'customFunctionModulePath');
        const packageManager = resolvePackageManagerForCustomFunction(
          customFunction.customFunctionModulePath
        );
        ctx.logger.info(
          `Detected package manager ${packageManager} for custom function ${customFunction.id}`
        );

        ctx.logger.info(`Installing dependencies for custom function ${customFunction.id}...`);
        await spawnAsync(packageManager, ['install'], {
          cwd: customFunction.customFunctionModulePath,
          logger: ctx.logger,
          env,
        });

        ctx.logger.info(`Compiling custom function ${customFunction.id}...`);
        await spawnAsync(packageManager, ['run', 'build'], {
          cwd: customFunction.customFunctionModulePath,
          logger: ctx.logger,
          env,
        });
      }
    },
  });
}

enum PackageManager {
  YARN = 'yarn',
  NPM = 'npm',
  PNPM = 'pnpm',
}

function resolvePackageManagerForCustomFunction(customFunctionModulePath: string): PackageManager {
  try {
    const manager = resolvePackageManager(customFunctionModulePath);

    if (manager === 'npm') {
      return PackageManager.NPM;
    } else if (manager === 'pnpm') {
      return PackageManager.PNPM;
    } else {
      return PackageManager.YARN;
    }
  } catch {
    return PackageManager.YARN;
  }
}
