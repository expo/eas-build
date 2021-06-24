import Joi from '@hapi/joi';

import {
  ArchiveSource,
  ArchiveSourceSchema,
  Env,
  EnvSchema,
  Platform,
  Workflow,
  Cache,
  CacheSchema,
} from './common';

export type DistributionType = 'store' | 'internal' | 'simulator';

const TargetCredentialsSchema = Joi.object().keys({
  provisioningProfileBase64: Joi.string().required(),
  distributionCertificate: Joi.object({
    dataBase64: Joi.string().required(),
    password: Joi.string().allow('').required(),
  }).required(),
});

export interface TargetCredentials {
  provisioningProfileBase64: string;
  distributionCertificate: DistributionCertificate;
}

const BuildCredentialsSchema = Joi.object().pattern(
  Joi.string().required(),
  TargetCredentialsSchema
);

type Target = string;
export type BuildCredentials = Record<Target, TargetCredentials>;

export interface DistributionCertificate {
  dataBase64: string;
  password: string;
}

export enum BuildType {
  RELEASE = 'release',
  DEVELOPMENT_CLIENT = 'development-client',
}

export const builderBaseImages = [
  'default',
  'latest',
  'stable',
  'macos-catalina-11.15-xcode-12.1', // incorrect name, keep for legacy cases
  'macos-catalina-11.15-xcode-12.4', // incorrect name, keep for legacy cases
  'macos-catalina-10.15-xcode-12.1',
  'macos-catalina-10.15-xcode-12.4',
  'macos-big-sur-11.4-xcode-12.5',
] as const;

export interface BuilderEnvironment {
  image: typeof builderBaseImages[number];
  node?: string;
  yarn?: string;
  expoCli?: string;
  bundler?: string;
  fastlane?: string;
  cocoapods?: string;
  env?: Env;
}

const BuilderEnvironmentSchema = Joi.object({
  image: Joi.string()
    .valid(...builderBaseImages)
    .default('default'),
  node: Joi.string(),
  yarn: Joi.string(),
  expoCli: Joi.string(),
  bundler: Joi.string(),
  fastlane: Joi.string(),
  cocoapods: Joi.string(),
  env: EnvSchema,
});

export interface Job {
  type: Workflow;
  projectArchive: ArchiveSource;
  platform: Platform.IOS;
  projectRootDirectory: string;
  releaseChannel?: string;
  updates?: {
    channel?: string;
  };
  distribution?: DistributionType;
  secrets: {
    buildCredentials?: BuildCredentials;
    environmentSecrets?: Env;
  };
  builderEnvironment?: BuilderEnvironment;
  cache: Cache;

  scheme?: string;
  buildConfiguration?: string;
  artifactPath: string;

  buildType?: BuildType;
  username?: string;
}

export const JobSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(Workflow))
    .required(),
  projectArchive: ArchiveSourceSchema.required(),
  platform: Joi.string().valid(Platform.IOS).required(),
  projectRootDirectory: Joi.string().required(),
  releaseChannel: Joi.string(),
  updates: Joi.object({
    channel: Joi.string(),
  }),
  distribution: Joi.string().valid('store', 'internal', 'simulator'),
  secrets: Joi.object({
    buildCredentials: BuildCredentialsSchema,
    environmentSecrets: EnvSchema,
  }).required(),
  builderEnvironment: BuilderEnvironmentSchema,
  cache: CacheSchema.default(),

  // generic
  scheme: Joi.string(),
  buildConfiguration: Joi.string(),
  artifactPath: Joi.string(),

  // managed
  buildType: Joi.string().valid(...Object.values(BuildType)),
  username: Joi.string(),
}).oxor('releaseChannel', 'updates.channel');
