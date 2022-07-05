import Joi from 'joi';

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

export const builderBaseImages = [
  'default',
  'latest',
  'stable',
  'macos-big-sur-11.4-xcode-12.5',
  'macos-big-sur-11.4-xcode-13.0',
  'macos-monterey-12.1-xcode-13.2',
  'macos-monterey-12.3-xcode-13.3',
  'macos-monterey-12.4-xcode-13.4',
] as const;

export const sdkVersionToDefaultBuilderImage: Record<string, typeof builderBaseImages[number]> = {
  '<=44': 'macos-big-sur-11.4-xcode-13.0',
  '45': 'macos-monterey-12.3-xcode-13.3',
};

export interface BuilderEnvironment {
  image?: typeof builderBaseImages[number];
  node?: string;
  yarn?: string;
  expoCli?: string;
  bundler?: string;
  fastlane?: string;
  cocoapods?: string;
  env?: Env;
}

const BuilderEnvironmentSchema = Joi.object({
  image: Joi.string().valid(...builderBaseImages),
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
  secrets: {
    buildCredentials?: BuildCredentials;
    environmentSecrets?: Env;
  };
  builderEnvironment?: BuilderEnvironment;
  cache: Cache;
  developmentClient?: boolean;
  simulator?: boolean;
  version?: {
    buildNumber?: string;
    /**
     * support for this field is implemented, but specifying it is disabled on schema level
     */
    version?: string;
    /**
     * support for this field is implemented, but specifying it is disabled on schema level
     */
    runtimeVersion?: string;
  };

  scheme?: string;
  buildConfiguration?: string;
  artifactPath?: string;

  username?: string;

  experimental?: {
    prebuildCommand?: string;
  };
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
  secrets: Joi.object({
    buildCredentials: BuildCredentialsSchema,
    environmentSecrets: EnvSchema,
  }).required(),
  builderEnvironment: BuilderEnvironmentSchema,
  cache: CacheSchema.default(),
  developmentClient: Joi.boolean(),
  simulator: Joi.boolean(),
  version: Joi.object({
    buildNumber: Joi.string(),
  }),

  // generic
  scheme: Joi.string(),
  buildConfiguration: Joi.string(),
  artifactPath: Joi.string(),

  // managed
  username: Joi.string(),

  experimental: Joi.object({
    prebuildCommand: Joi.string(),
  }),
}).oxor('releaseChannel', 'updates.channel');
