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
  ImageMatchRule,
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
  'macos-monterey-12.6-xcode-14.0',
  'macos-monterey-12.6-xcode-14.1',
] as const;

export const imageMatchRules: ImageMatchRule<typeof builderBaseImages[number]>[] = [
  {
    image: 'macos-big-sur-11.4-xcode-13.0',
    sdkSemverRange: '<=44',
    workflows: [Workflow.MANAGED],
  },
  {
    image: 'macos-monterey-12.4-xcode-13.4',
    sdkSemverRange: '>=45 <47',
    workflows: [Workflow.MANAGED],
  },
  {
    image: 'macos-monterey-12.6-xcode-14.0',
    sdkSemverRange: '>=47',
  },
  {
    image: 'macos-monterey-12.6-xcode-14.0',
    reactNativeSemverRange: '>=0.70.0',
  },
];

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
    environmentSecrets?: EnvironmentSecret[];
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
    environmentSecrets: EnvironmentSecretsSchema,
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
