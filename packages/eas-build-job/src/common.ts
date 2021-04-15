import Joi from '@hapi/joi';

export enum Workflow {
  GENERIC = 'generic',
  MANAGED = 'managed',
}

export enum Platform {
  ANDROID = 'android',
  IOS = 'ios',
}

export enum ArchiveSourceType {
  S3 = 'S3',
  URL = 'URL',
  PATH = 'PATH',
}

export type ArchiveSource =
  | { type: ArchiveSourceType.S3; bucketKey: string }
  | { type: ArchiveSourceType.URL; url: string }
  | { type: ArchiveSourceType.PATH; path: string };

export const ArchiveSourceSchema = Joi.object<ArchiveSource>({
  type: Joi.string()
    .valid(...Object.values(ArchiveSourceType))
    .required(),
})
  .when(Joi.object({ type: ArchiveSourceType.S3 }).unknown(), {
    then: Joi.object({
      type: Joi.string().valid(ArchiveSourceType.S3).required(),
      bucketKey: Joi.string().required(),
    }),
  })
  .when(Joi.object({ type: ArchiveSourceType.URL }).unknown(), {
    then: Joi.object({
      type: Joi.string().valid(ArchiveSourceType.URL).required(),
      url: Joi.string().uri().required(),
    }),
  })
  .when(Joi.object({ type: ArchiveSourceType.PATH }).unknown(), {
    then: Joi.object({
      type: Joi.string().valid(ArchiveSourceType.PATH).required(),
      path: Joi.string().required(),
    }),
  });

export type Env = Record<string, string>;

export const EnvSchema = Joi.object().pattern(Joi.string(), Joi.string());

export interface Cache {
  disabled: boolean;
  key?: string;
  cacheDefaultPaths: boolean;
  customPaths: string[];
}

export const CacheSchema = Joi.object({
  disabled: Joi.boolean().default(false),
  key: Joi.string().allow('').max(128),
  cacheDefaultPaths: Joi.boolean().default(true),
  customPaths: Joi.array().items(Joi.string()).default([]),
});
