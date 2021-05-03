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

export enum SchemeBuildConfiguration {
  RELEASE = 'Release',
  DEBUG = 'Debug',
}

const TargetCredentialsSchema = Joi.object().keys({
  provisioningProfileBase64: Joi.string().required(),
  distributionCertificate: Joi.object({
    dataBase64: Joi.string().required(),
    password: Joi.string().required(),
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
  'macos-catalina-11.15-xcode-12.1',
  'macos-catalina-11.15-xcode-12.4',
] as const;

export interface BuilderEnvironment {
  image: typeof builderBaseImages[number];
  node?: string;
  yarn?: string;
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
  bundler: Joi.string(),
  fastlane: Joi.string(),
  cocoapods: Joi.string(),
  env: EnvSchema,
});

interface BaseJob {
  projectArchive: ArchiveSource;
  platform: Platform.IOS;
  projectRootDirectory: string;
  releaseChannel?: string;
  distribution?: DistributionType;
  secrets: {
    buildCredentials?: BuildCredentials;
    environmentSecrets?: Env;
  };
  builderEnvironment?: BuilderEnvironment;
  cache: Cache;
}

const BaseJobSchema = Joi.object().keys({
  projectArchive: ArchiveSourceSchema.required(),
  platform: Joi.string().valid(Platform.IOS).required(),
  projectRootDirectory: Joi.string().required(),
  releaseChannel: Joi.string(),
  distribution: Joi.string().valid('store', 'internal', 'simulator'),
  secrets: Joi.object({
    buildCredentials: BuildCredentialsSchema,
    environmentSecrets: EnvSchema,
  }).required(),
  builderEnvironment: BuilderEnvironmentSchema,
  cache: CacheSchema.default(),
});

export interface GenericJob extends BaseJob {
  type: Workflow.GENERIC;
  scheme: string;
  schemeBuildConfiguration?: SchemeBuildConfiguration;
  buildConfiguration?: string;
  artifactPath: string;
}

export const GenericJobSchema = BaseJobSchema.concat(
  Joi.object().keys({
    type: Joi.string().valid(Workflow.GENERIC),
    scheme: Joi.string().required(),
    schemeBuildConfiguration: Joi.string().valid('Release', 'Debug'),
    buildConfiguration: Joi.string(),
    artifactPath: Joi.alternatives().conditional('distribution', {
      is: 'simulator',
      then: Joi.string().default('ios/build/Build/Products/*-iphonesimulator/*.app'),
      otherwise: Joi.string().default('ios/build/*.ipa'),
    }),
  })
);

export enum ManagedBuildType {
  RELEASE = 'release',
  DEVELOPMENT_CLIENT = 'development-client',
}

export interface ManagedJob extends BaseJob {
  type: Workflow.MANAGED;
  buildType?: ManagedBuildType;
  username?: string;
}

export const ManagedJobSchema = BaseJobSchema.concat(
  Joi.object({
    type: Joi.string().valid(Workflow.MANAGED),
    buildType: Joi.string().valid(...Object.values(ManagedBuildType)),
    username: Joi.string(),
  })
);

export type Job = GenericJob | ManagedJob;

export const JobSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(Workflow))
    .required(),
})
  .when(Joi.object({ type: Workflow.GENERIC }).unknown(), { then: GenericJobSchema })
  .when(Joi.object({ type: Workflow.MANAGED }).unknown(), { then: ManagedJobSchema });
