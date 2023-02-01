import Joi from 'joi';

export const BuildConfigSchema = Joi.object<BuildConfig>({
  build: Joi.object({
    name: Joi.string(),
    steps: Joi.array()
      .items(
        Joi.object({
          run: Joi.alternatives(
            Joi.string(),
            Joi.object({
              id: Joi.string(),
              name: Joi.string(),
              workingDirectory: Joi.string(),
              shell: Joi.string(),
              command: Joi.string().required(),
            }).rename('working_directory', 'workingDirectory')
          ),
        })
      )
      .required(),
  }).required(),
}).required();

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
