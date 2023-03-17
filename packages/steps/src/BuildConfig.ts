import assert from 'assert';

import Joi from 'joi';

import { BuildConfigError } from './errors/BuildConfigError.js';
import { BuildPlatform } from './BuildPlatform.js';

export interface BuildConfig {
  build: {
    name?: string;
    steps: BuildStepConfig[];
  };
  functions?: Record<string, BuildFunctionConfig>;
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
export type BuildStepOutputs = BuildInputOutputParameters;

export interface BuildFunctionConfig {
  inputs?: BuildFunctionInputs;
  outputs?: BuildFunctionOutputs;
  name?: string;
  platforms?: BuildPlatform[];
  shell?: string;
  command: string;
}

export type BuildFunctionInputs = BuildInputOutputParameters;
export type BuildFunctionOutputs = BuildInputOutputParameters;

export type BuildInputOutputParameters = (
  | string
  | {
      name: string;
      required?: boolean;
    }
)[];

const BuildInputOutputParametersSchema = Joi.array().items(
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
        outputs: BuildInputOutputParametersSchema,
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
  inputs: BuildInputOutputParametersSchema,
  outputs: BuildInputOutputParametersSchema,
  command: Joi.string().required(),
  shell: Joi.string(),
});

export const BuildConfigSchema = Joi.object<BuildConfig>({
  build: Joi.object({
    name: Joi.string(),
    steps: Joi.array().items(BuildStepConfigSchema.required()).required(),
  }).required(),
  functions: Joi.object().pattern(
    Joi.string()
      .pattern(/^[\w-]+$/, 'function names')
      .min(1)
      .required()
      .disallow('run'),
    BuildFunctionConfigSchema.required()
  ),
}).required();

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

export function validateBuildConfig(rawConfig: object, externalFunctionIds: string[]): BuildConfig {
  const { error, value: buildConfig } = BuildConfigSchema.validate(rawConfig, {
    allowUnknown: false,
    abortEarly: false,
  });
  if (error) {
    const errorMessage = error.details.map(({ message }) => message).join(', ');
    throw new BuildConfigError(errorMessage, { cause: error });
  }
  validateAllFunctionsExist(buildConfig, externalFunctionIds);
  return buildConfig;
}

function validateAllFunctionsExist(config: BuildConfig, externalFunctionIds: string[]): void {
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
