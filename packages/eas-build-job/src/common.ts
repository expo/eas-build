import Joi from 'joi';

import { BuildPhase, BuildPhaseResult } from './logs';

export enum Workflow {
  GENERIC = 'generic',
  MANAGED = 'managed',
  CI = 'ci',
}

export enum Platform {
  ANDROID = 'android',
  IOS = 'ios',
}

export enum ArchiveSourceType {
  S3 = 'S3',
  URL = 'URL',
  PATH = 'PATH',
  GCS = 'GCS',
  GIT = 'GIT',
}

export type ArchiveSource =
  | { type: ArchiveSourceType.S3; bucketKey: string }
  | { type: ArchiveSourceType.GCS; bucketKey: string }
  | { type: ArchiveSourceType.URL; url: string }
  | { type: ArchiveSourceType.PATH; path: string }
  | { type: ArchiveSourceType.GIT; repositoryUrl: string; ref: string };

export const ArchiveSourceSchema = Joi.object<ArchiveSource>({
  type: Joi.string()
    .valid(...Object.values(ArchiveSourceType))
    .required(),
})
  .when(Joi.object({ type: ArchiveSourceType.GCS }).unknown(), {
    then: Joi.object({
      type: Joi.string().valid(ArchiveSourceType.GCS).required(),
      bucketKey: Joi.string().required(),
    }),
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
  .when(Joi.object({ type: ArchiveSourceType.GIT }).unknown(), {
    then: Joi.object({
      type: Joi.string().valid(ArchiveSourceType.GIT).required(),
      repositoryUrl: Joi.string().required(),
      ref: Joi.string().required(),
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

export type EnvironmentSecret = {
  name: string;
  type: EnvironmentSecretType;
  value: string;
};
export enum EnvironmentSecretType {
  STRING = 'string',
  FILE = 'file',
}
export const EnvironmentSecretsSchema = Joi.array().items(
  Joi.object({
    name: Joi.string().required(),
    value: Joi.string().required(),
    type: Joi.string()
      .valid(...Object.values(EnvironmentSecretType))
      .required(),
  })
);

export interface Cache {
  disabled: boolean;
  clear: boolean;
  key?: string;
  cacheDefaultPaths: boolean;
  customPaths: string[];
}

export const CacheSchema = Joi.object({
  disabled: Joi.boolean().default(false),
  clear: Joi.boolean().default(false),
  key: Joi.string().allow('').max(128),
  cacheDefaultPaths: Joi.boolean().default(true),
  customPaths: Joi.array().items(Joi.string()).default([]),
});

export interface BuildPhaseStats {
  buildPhase: BuildPhase;
  result: BuildPhaseResult;
  durationMs: number;
}

export interface ImageMatchRule<Image extends string> {
  image: Image;
  reactNativeSemverRange?: string;
  sdkSemverRange?: string;
  workflows?: Workflow[];
}
