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

export type BuildFunctionCallConfig = {
  id?: string;
  inputs?: BuildStepInputsConfig;
  name?: string;
  workingDirectory?: string;
  shell?: string;
};

export type BuildStepConfig =
  | string
  | {
      run:
        | string
        | (BuildFunctionCallConfig & {
            outputs?: BuildStepOutputsConfig;
            command: string;
          });
    }
  | {
      [functionId: string]: BuildFunctionCallConfig;
    };

export type BuildStepInputsConfig = Record<string, string>;
export type BuildStepOutputsConfig = BuildInputOutputParametersConfig;

export interface BuildFunctionConfig {
  id?: string;
  inputs?: BuildFunctionInputsConfig;
  outputs?: BuildFunctionOutputsConfig;
  name?: string;
  platforms?: BuildPlatform[];
  shell?: string;
  command: string;
}

export type BuildFunctionInputsConfig = BuildInputOutputParametersConfig;
export type BuildFunctionOutputsConfig = BuildInputOutputParametersConfig;

export type BuildInputOutputParametersConfig = (
  | string
  | {
      name: string;
      required?: boolean;
    }
)[];

const BuildInputOutputParametersConfigSchema = Joi.array().items(
  Joi.alternatives().try(
    Joi.string().required(),
    Joi.object({
      name: Joi.string().required(),
      required: Joi.boolean(),
    }).required()
  )
);

export const BuildConfigSchema = Joi.object<BuildConfig>({
  build: Joi.object({
    name: Joi.string(),
    steps: Joi.array()
      .items(
        Joi.alternatives().conditional(Joi.object({ run: Joi.any().required() }).unknown(), {
          then: Joi.object({
            run: Joi.alternatives()
              .conditional(Joi.string(), {
                then: Joi.string().min(1).required(),
                otherwise: Joi.object({
                  id: Joi.string(),
                  inputs: Joi.object().pattern(Joi.string(), Joi.string()),
                  outputs: BuildInputOutputParametersConfigSchema,
                  name: Joi.string(),
                  workingDirectory: Joi.string(),
                  shell: Joi.string(),
                  command: Joi.string().required(),
                })
                  .rename('working_directory', 'workingDirectory')
                  .required(),
              })
              .required(),
          }),
          otherwise: Joi.alternatives().conditional(Joi.string(), {
            then: Joi.string().min(1).required(),
            otherwise: Joi.object()
              .pattern(
                Joi.string().min(1).required(),
                Joi.object({
                  id: Joi.string(),
                  inputs: Joi.object().pattern(Joi.string(), Joi.string()),
                  name: Joi.string(),
                  workingDirectory: Joi.string(),
                  shell: Joi.string(),
                }).required(),
                { matches: Joi.array().length(1) }
              )
              .required(),
          }),
        })
      )
      .required(),
  }).required(),
  functions: Joi.object().pattern(
    Joi.string().min(1).required(),
    Joi.object({
      id: Joi.string(),
      name: Joi.string(),
      platforms: Joi.string().allow(...Object.values(BuildPlatform)),
      inputs: BuildInputOutputParametersConfigSchema,
      outputs: BuildInputOutputParametersConfigSchema,
      command: Joi.string().required(),
      shell: Joi.string(),
    }).required()
  ),
}).required();

export function validateBuildConfig(rawConfig: object): BuildConfig {
  const { error, value: buildConfig } = BuildConfigSchema.validate(rawConfig, {
    allowUnknown: false,
    abortEarly: false,
  });
  if (error) {
    const errorMessage = error.details.map(({ message }) => message).join(', ');
    throw new BuildConfigError(errorMessage, { cause: error });
  }
  validateAllFunctionsExist(buildConfig);
  return buildConfig;
}

function validateAllFunctionsExist(config: BuildConfig): void {
  const calledFunctionsSet = new Set<string>();
  for (const step of config.build.steps) {
    if (typeof step === 'string') {
      calledFunctionsSet.add(step);
    } else if (!('run' in step)) {
      const keys = Object.keys(step);
      assert(
        keys.length === 1,
        'There must be at most one function call in the step (enforced by joi)'
      );
      calledFunctionsSet.add(keys[0]);
    }
  }
  const calledFunctions = Array.from(calledFunctionsSet);
  const nonExistentFunctions = calledFunctions.filter((calledFunction) => {
    return !(calledFunction in (config.functions ?? {}));
  });
  if (nonExistentFunctions.length > 0) {
    throw new BuildConfigError(
      `Calling non-existent functions: ${nonExistentFunctions.join(', ')}`
    );
  }
}
