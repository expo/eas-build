import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

import Joi from 'joi';
import YAML from 'yaml';

import { BuildConfigError, BuildWorkflowError } from './errors.js';
import { BuildPlatform } from './BuildPlatform.js';
import { BuildFunction } from './BuildFunction.js';

export type BuildFunctions = Record<string, BuildFunctionConfig>;

interface BuildFunctionsConfigFile {
  configFilesToImport?: string[];
  functions?: BuildFunctions;
}

export interface BuildConfig extends BuildFunctionsConfigFile {
  build: {
    name?: string;
    steps: BuildStepConfig[];
  };
}

export type BuildStepConfig =
  | BuildStepCommandRun
  | BuildStepBareCommandRun
  | BuildStepFunctionCall
  | BuildStepBareFunctionCall;

export type BuildStepCommandRun = {
  run: BuildFunctionCallConfig & {
    outputs?: BuildStepOutputs;
    command: string;
  };
};
export type BuildStepBareCommandRun = { run: string };
export type BuildStepFunctionCall = {
  [functionId: string]: BuildFunctionCallConfig;
};
export type BuildStepBareFunctionCall = string;

export type BuildFunctionCallConfig = {
  id?: string;
  inputs?: BuildStepInputs;
  name?: string;
  workingDirectory?: string;
  shell?: string;
};

export type BuildStepInputs = Record<string, string>;
export type BuildStepOutputs = (
  | string
  | {
      name: string;
      required?: boolean;
    }
)[];

export interface BuildFunctionConfig {
  inputs?: BuildFunctionInputs;
  outputs?: BuildFunctionOutputs;
  name?: string;
  platforms?: BuildPlatform[];
  shell?: string;
  command: string;
}

export type BuildFunctionInputs = (
  | string
  | {
      name: string;
      defaultValue?: string;
      allowedValues?: string[];
      required?: boolean;
    }
)[];
export type BuildFunctionOutputs = BuildStepOutputs;

const BuildFunctionInputsSchema = Joi.array().items(
  Joi.alternatives().try(
    Joi.string().required(),
    Joi.object({
      name: Joi.string().required(),
      defaultValue: Joi.alternatives().conditional('allowedValues', {
        is: Joi.exist(),
        then: Joi.string()
          .valid(Joi.in('allowedValues'))
          .messages({ 'any.only': '{{#label}} must be one of allowed values' }),
        otherwise: Joi.string(),
      }),
      allowedValues: Joi.array().items(Joi.string()),
      required: Joi.boolean(),
    })
      .rename('allowed_values', 'allowedValues')
      .rename('default_value', 'defaultValue')
      .required()
  )
);

const BuildStepOutputsSchema = Joi.array().items(
  Joi.alternatives().try(
    Joi.string().required(),
    Joi.object({
      name: Joi.string().required(),
      required: Joi.boolean(),
    }).required()
  )
);

const BuildFunctionCallSchema = Joi.object({
  id: Joi.string(),
  inputs: Joi.object().pattern(Joi.string(), Joi.string()),
  name: Joi.string(),
  workingDirectory: Joi.string(),
  shell: Joi.string(),
}).rename('working_directory', 'workingDirectory');

const BuildStepConfigSchema = Joi.any<BuildStepConfig>()
  .when(
    Joi.object().pattern(
      Joi.string().disallow('run').required(),
      Joi.object().unknown().required()
    ),
    {
      then: Joi.object().pattern(
        Joi.string().disallow('run').min(1).required(),
        BuildFunctionCallSchema.required(),
        { matches: Joi.array().length(1) }
      ),
    }
  )
  .when(Joi.object({ run: Joi.object().unknown().required() }), {
    then: Joi.object({
      run: BuildFunctionCallSchema.keys({
        outputs: BuildStepOutputsSchema,
        command: Joi.string().required(),
      }),
    }),
  })
  .when(Joi.object({ run: Joi.string().required() }), {
    then: Joi.object({
      run: Joi.string().min(1).required(),
    }),
  })
  .when(Joi.string(), {
    then: Joi.string().min(1),
  });

const BuildFunctionConfigSchema = Joi.object({
  name: Joi.string(),
  platforms: Joi.string().allow(...Object.values(BuildPlatform)),
  inputs: BuildFunctionInputsSchema,
  outputs: BuildStepOutputsSchema,
  command: Joi.string().required(),
  shell: Joi.string(),
});

export const BuildFunctionsConfigFileSchema = Joi.object<BuildFunctionsConfigFile>({
  configFilesToImport: Joi.array().items(Joi.string().pattern(/\.y(a)?ml$/)),
  functions: Joi.object().pattern(
    Joi.string()
      .pattern(/^[\w-]+$/, 'function names')
      .min(1)
      .required()
      .disallow('run'),
    BuildFunctionConfigSchema.required()
  ),
})
  .rename('import', 'configFilesToImport')
  .required();

export const BuildConfigSchema = BuildFunctionsConfigFileSchema.append<BuildConfig>({
  build: Joi.object({
    name: Joi.string(),
    steps: Joi.array().items(BuildStepConfigSchema.required()).required(),
  }).required(),
}).required();

interface BuildConfigValidationParams {
  externalFunctionIds?: string[];
  skipNamespacedFunctionsCheck?: boolean;
}

export async function readAndValidateBuildConfigAsync(
  configPath: string,
  params: BuildConfigValidationParams = {}
): Promise<BuildConfig> {
  const rawConfig = await readRawBuildConfigAsync(configPath);

  const config = validateConfig(BuildConfigSchema, rawConfig);
  const importedFunctions = await importFunctionsAsync(configPath, config.configFilesToImport);
  mergeConfigWithImportedFunctions(config, importedFunctions);
  validateAllFunctionsExist(config, params);
  return config;
}

async function importFunctionsAsync(
  baseConfigPath: string,
  configPathsToImport?: string[]
): Promise<BuildFunctions> {
  if (!configPathsToImport) {
    return {};
  }

  const baseConfigDir = path.dirname(baseConfigPath);

  const errors: BuildConfigError[] = [];
  const importedFunctions: BuildFunctions = {};
  // this is a set of visited files identified by ABSOLUTE paths
  const visitedFiles = new Set<string>([baseConfigPath]);
  const configFilesToVisit = (configPathsToImport ?? []).map((childConfigRelativePath) =>
    path.resolve(baseConfigDir, childConfigRelativePath)
  );
  while (configFilesToVisit.length > 0) {
    const childConfigPath = configFilesToVisit.shift();
    assert(childConfigPath, 'Guaranteed by loop condition');
    if (visitedFiles.has(childConfigPath)) {
      continue;
    }
    visitedFiles.add(childConfigPath);
    try {
      const childConfig = await readAndValidateBuildFunctionsConfigFileAsync(childConfigPath);
      for (const functionName in childConfig.functions) {
        if (!(functionName in importedFunctions)) {
          importedFunctions[functionName] = childConfig.functions[functionName];
        }
      }
      if (childConfig.configFilesToImport) {
        const childDir = path.dirname(childConfigPath);
        configFilesToVisit.push(
          ...childConfig.configFilesToImport.map((relativePath) =>
            path.resolve(childDir, relativePath)
          )
        );
      }
    } catch (err) {
      if (err instanceof BuildConfigError) {
        errors.push(err);
      } else {
        throw err;
      }
    }
  }
  if (errors.length > 0) {
    throw new BuildWorkflowError(`Detected build config errors in imported files.`, errors);
  }
  return importedFunctions;
}

export async function readAndValidateBuildFunctionsConfigFileAsync(
  configPath: string
): Promise<BuildFunctionsConfigFile> {
  const rawConfig = await readRawBuildConfigAsync(configPath);
  return validateConfig(BuildFunctionsConfigFileSchema, rawConfig);
}

export async function readRawBuildConfigAsync(configPath: string): Promise<any> {
  const contents = await fs.readFile(configPath, 'utf-8');
  return YAML.parse(contents);
}

export function validateConfig<T>(
  schema: Joi.ObjectSchema<T>,
  config: object,
  configFilePath?: string
): T {
  const { error, value } = schema.validate(config, {
    allowUnknown: false,
    abortEarly: false,
  });
  if (error) {
    const errorMessage = error.details.map(({ message }) => message).join(', ');
    throw new BuildConfigError(errorMessage, {
      cause: error,
      ...(configFilePath && { metadata: { configFilePath } }),
    });
  }
  return value;
}

export function mergeConfigWithImportedFunctions(
  config: BuildConfig,
  importedFunctions: BuildFunctions
): void {
  if (Object.keys(importedFunctions).length === 0) {
    return;
  }
  config.functions = config.functions ?? {};
  for (const functionName in importedFunctions) {
    if (!(functionName in config.functions)) {
      config.functions[functionName] = importedFunctions[functionName];
    }
  }
}

export function isBuildStepCommandRun(step: BuildStepConfig): step is BuildStepCommandRun {
  return typeof step === 'object' && typeof step.run === 'object';
}

export function isBuildStepBareCommandRun(step: BuildStepConfig): step is BuildStepBareCommandRun {
  return typeof step === 'object' && typeof step.run === 'string';
}

export function isBuildStepFunctionCall(step: BuildStepConfig): step is BuildStepFunctionCall {
  return typeof step === 'object' && !('run' in step);
}

export function isBuildStepBareFunctionCall(
  step: BuildStepConfig
): step is BuildStepBareFunctionCall {
  return typeof step === 'string';
}

export function validateAllFunctionsExist(
  config: BuildConfig,
  { externalFunctionIds = [], skipNamespacedFunctionsCheck }: BuildConfigValidationParams
): void {
  const calledFunctionsSet = new Set<string>();
  for (const step of config.build.steps) {
    if (typeof step === 'string') {
      calledFunctionsSet.add(step);
    } else if (!('run' in step)) {
      const keys = Object.keys(step);
      assert(
        keys.length === 1,
        'There must be at most one function call in the step (enforced by joi).'
      );
      calledFunctionsSet.add(keys[0]);
    }
  }
  const calledFunctions = Array.from(calledFunctionsSet);
  const externalFunctionIdsSet = new Set(externalFunctionIds);
  const nonExistentFunctions = calledFunctions.filter((calledFunction) => {
    if (BuildFunction.isFulldIdNamespaced(calledFunction) && skipNamespacedFunctionsCheck) {
      return false;
    }
    return (
      !(calledFunction in (config.functions ?? {})) && !externalFunctionIdsSet.has(calledFunction)
    );
  });
  if (nonExistentFunctions.length > 0) {
    throw new BuildConfigError(
      `Calling non-existent functions: ${nonExistentFunctions.map((f) => `"${f}"`).join(', ')}.`
    );
  }
}
