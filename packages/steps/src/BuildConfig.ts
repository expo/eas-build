import Joi from 'joi';

import { BuildConfigError } from './errors/BuildConfigError.js';

export interface BuildConfig {
  build: {
    name?: string;
    steps: BuildStepConfig[];
  };
}

export type BuildStepConfig =
  | string
  | {
      run:
        | string
        | {
            id?: string;
            name?: string;
            workingDirectory?: string;
            shell?: string;
            command: string;
          };
    };

export const BuildConfigSchema = Joi.object<BuildConfig>({
  build: Joi.object({
    name: Joi.string(),
    steps: Joi.array()
      .items(
        Joi.object({
          run: Joi.alternatives().conditional('run', {
            is: Joi.string(),
            then: Joi.string().required(),
            otherwise: Joi.object({
              id: Joi.string(),
              name: Joi.string(),
              workingDirectory: Joi.string(),
              shell: Joi.string(),
              command: Joi.string().required(),
            })
              .rename('working_directory', 'workingDirectory')
              .required(),
          }),
        })
      )
      .required(),
  }).required(),
}).required();

export function validateBuildConfig(rawConfig: object): BuildConfig {
  const { error, value } = BuildConfigSchema.validate(rawConfig, {
    stripUnknown: true,
    abortEarly: false,
  });
  if (error) {
    const errorMessage = error.details.map(({ message }) => message).join(', ');
    throw new BuildConfigError(errorMessage, { cause: error });
  } else {
    return value;
  }
}
