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
  EnvironmentSecretsSchema,
  EnvironmentSecret,
  BuildTrigger,
  BuildMode,
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
export interface BuilderEnvironment {
  image?: string;
  node?: string;
  yarn?: string;
  expoCli?: string;
  bundler?: string;
  fastlane?: string;
  cocoapods?: string;
  env?: Env;
}

const BuilderEnvironmentSchema = Joi.object({
  image: Joi.string(),
  node: Joi.string(),
  yarn: Joi.string(),
  expoCli: Joi.string(),
  bundler: Joi.string(),
  fastlane: Joi.string(),
  cocoapods: Joi.string(),
  env: EnvSchema,
});

export interface Job {
  mode: BuildMode;
  type: Workflow;
  triggeredBy: BuildTrigger;
  projectArchive: ArchiveSource;
  resign?: {
    applicationArchiveSource: ArchiveSource;
  };
  platform: Platform.IOS;
  projectRootDirectory?: string;
  buildProfile?: string;
  releaseChannel?: string;
  updates?: {
    channel?: string;
  };
  secrets: {
    buildCredentials?: BuildCredentials;
    environmentSecrets?: EnvironmentSecret[];
    robotAccessToken?: string;
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
    appVersion?: string;
    /**
     * support for this field is implemented, but specifying it is disabled on schema level
     */
    runtimeVersion?: string;
  };
  buildArtifactPaths?: string[];

  scheme?: string;
  buildConfiguration?: string;
  applicationArchivePath?: string;

  username?: string;

  experimental?: {
    prebuildCommand?: string;
  };
}

export const JobSchema = Joi.object({
  mode: Joi.string()
    .valid(...Object.values(BuildMode))
    .default(BuildMode.BUILD),
  type: Joi.when('mode', {
    is: Joi.string().valid(BuildMode.BUILD),
    then: Joi.string()
      .valid(...Object.values(Workflow))
      .required(),
    otherwise: Joi.string().valid(Workflow.UNKNOWN).default(Workflow.UNKNOWN),
  }),
  triggeredBy: Joi.string()
    .valid(...Object.values(BuildTrigger))
    .default(BuildTrigger.EAS_CLI),
  projectArchive: ArchiveSourceSchema.required(),
  resign: Joi.when('mode', {
    is: Joi.string().valid(BuildMode.BUILD),
    then: Joi.any().strip(),
    otherwise: Joi.object({
      applicationArchiveSource: ArchiveSourceSchema.required(),
    }).required(),
  }),
  platform: Joi.string().valid(Platform.IOS).required(),
  projectRootDirectory: Joi.when('mode', {
    is: Joi.string().valid(BuildMode.BUILD),
    then: Joi.string().required(),
    otherwise: Joi.any().strip(),
  }),
  buildProfile: Joi.when('mode', {
    is: Joi.string().valid(BuildMode.BUILD),
    then: Joi.when('triggeredBy', {
      is: Joi.string().valid(BuildTrigger.GIT_BASED_INTEGRATION),
      then: Joi.string().required(),
      otherwise: Joi.string(),
    }),
    otherwise: Joi.string(),
  }),
  releaseChannel: Joi.string(),
  updates: Joi.object({
    channel: Joi.string(),
  }),
  secrets: Joi.object({
    buildCredentials: BuildCredentialsSchema,
    environmentSecrets: EnvironmentSecretsSchema,
    robotAccessToken: Joi.string(),
  }).required(),
  builderEnvironment: BuilderEnvironmentSchema,
  cache: CacheSchema.default(),
  developmentClient: Joi.boolean(),
  simulator: Joi.boolean(),
  version: Joi.object({
    buildNumber: Joi.string(),
  }),
  buildArtifactPaths: Joi.array().items(Joi.string()),

  scheme: Joi.string(),
  buildConfiguration: Joi.string(),
  applicationArchivePath: Joi.string(),

  username: Joi.string(),

  experimental: Joi.object({
    prebuildCommand: Joi.string(),
  }),
}).oxor('releaseChannel', 'updates.channel');
