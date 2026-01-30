import Joi from 'joi';
import { z } from 'zod';
import { LoggerLevel } from '@expo/logger';

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
  StaticWorkflowInterpolationContextZ,
  StaticWorkflowInterpolationContext,
  ArchiveSourceZ,
  EnvZ,
  CacheZ,
  EnvironmentSecretsZ,
  CustomBuildConfigZ,
  CustomBuildConfigSchema,
} from './common';
import { Step } from './step';

export type DistributionType = 'store' | 'internal' | 'simulator';

const TargetCredentialsZ = z.object({
  provisioningProfileBase64: z.string(),
  distributionCertificate: z.object({
    dataBase64: z.string(),
    password: z.string(),
  }),
});

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

const BuildCredentialsZ = z.record(z.string(), TargetCredentialsZ);

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
  corepack?: boolean;
  yarn?: string;
  bun?: string;
  pnpm?: string;
  bundler?: string;
  fastlane?: string;
  cocoapods?: string;
  env?: Env;
}

const BuilderEnvironmentZ = z.object({
  image: z.string().optional(),
  node: z.string().optional(),
  corepack: z.boolean().optional(),
  yarn: z.string().optional(),
  pnpm: z.string().optional(),
  bun: z.string().optional(),
  bundler: z.string().optional(),
  fastlane: z.string().optional(),
  cocoapods: z.string().optional(),
  env: EnvZ.optional(),
});

const BuilderEnvironmentSchema = Joi.object({
  image: Joi.string(),
  node: Joi.string(),
  corepack: Joi.boolean(),
  yarn: Joi.string(),
  pnpm: Joi.string(),
  bun: Joi.string(),
  bundler: Joi.string(),
  fastlane: Joi.string(),
  cocoapods: Joi.string(),
  env: EnvSchema,
});

export interface BuildSecrets {
  buildCredentials?: BuildCredentials;
  environmentSecrets?: EnvironmentSecret[];
  robotAccessToken?: string;
}

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
  updates?: {
    channel?: string;
  };
  secrets?: BuildSecrets;
  builderEnvironment?: BuilderEnvironment;
  cache?: Cache;
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

  customBuildConfig?: {
    path: string;
  };
  steps?: Step[];
  outputs?: Record<string, string>;

  experimental?: {
    prebuildCommand?: string;
  };
  expoBuildUrl?: string;
  githubTriggerOptions?: {
    autoSubmit: boolean;
    submitProfile?: string;
  };
  loggerLevel?: LoggerLevel;

  workflowInterpolationContext?: StaticWorkflowInterpolationContext;

  initiatingUserId: string;
  appId: string;

  environment?: string;
}

const SecretsZ = z.object({
  buildCredentials: BuildCredentialsZ.optional(),
  environmentSecrets: EnvironmentSecretsZ.optional(),
  robotAccessToken: z.string().optional(),
});

const SecretsSchema = Joi.object({
  buildCredentials: BuildCredentialsSchema,
  environmentSecrets: EnvironmentSecretsSchema,
  robotAccessToken: Joi.string(),
});

export const JobSchema = Joi.object({
  mode: Joi.string()
    .valid(...Object.values(BuildMode))
    .default(BuildMode.BUILD),
  type: Joi.when('mode', {
    is: Joi.string().valid(BuildMode.RESIGN),
    then: Joi.string().valid(Workflow.UNKNOWN).default(Workflow.UNKNOWN),
    otherwise: Joi.string()
      .valid(...Object.values(Workflow))
      .required(),
  }),
  triggeredBy: Joi.string()
    .valid(...Object.values(BuildTrigger))
    .default(BuildTrigger.EAS_CLI),
  projectArchive: ArchiveSourceSchema.required(),
  resign: Joi.when('mode', {
    is: Joi.string().valid(BuildMode.RESIGN),
    then: Joi.object({
      applicationArchiveSource: ArchiveSourceSchema.required(),
    }).required(),
    otherwise: Joi.any().strip(),
  }),
  platform: Joi.string().valid(Platform.IOS).required(),
  projectRootDirectory: Joi.when('mode', {
    is: Joi.string().valid(BuildMode.RESIGN),
    then: Joi.any().strip(),
    otherwise: Joi.string().required(),
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
  updates: Joi.object({
    channel: Joi.string(),
  }),
  secrets: Joi.when('mode', {
    is: Joi.string().valid(BuildMode.CUSTOM),
    then: SecretsSchema,
    otherwise: SecretsSchema.required(),
  }),
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
  expoBuildUrl: Joi.string().uri().optional(),
  githubTriggerOptions: Joi.object({
    autoSubmit: Joi.boolean().default(false),
    submitProfile: Joi.string(),
  }),
  loggerLevel: Joi.string().valid(...Object.values(LoggerLevel)),

  initiatingUserId: Joi.string().required(),
  appId: Joi.string().required(),

  environment: Joi.string(),

  workflowInterpolationContext: Joi.object().custom((workflowInterpolationContext) =>
    StaticWorkflowInterpolationContextZ.optional().parse(workflowInterpolationContext)
  ),
}).concat(CustomBuildConfigSchema);

export const JobZ = z
  .object({
    triggeredBy: z.nativeEnum(BuildTrigger).default(BuildTrigger.EAS_CLI),
    projectArchive: ArchiveSourceZ,
    platform: z.literal(Platform.IOS),
    updates: z
      .object({
        channel: z.string().optional(),
      })
      .optional(),
    builderEnvironment: BuilderEnvironmentZ.optional(),
    cache: CacheZ.default({
      disabled: false,
      clear: false,
      paths: [],
    }),
    developmentClient: z.boolean().optional(),
    simulator: z.boolean().optional(),
    version: z
      .object({
        buildNumber: z.string().optional(),
      })
      .optional(),
    buildArtifactPaths: z.array(z.string()).optional(),

    scheme: z.string().optional(),
    buildConfiguration: z.string().optional(),
    applicationArchivePath: z.string().optional(),

    username: z.string().optional(),

    experimental: z
      .object({
        prebuildCommand: z.string().optional(),
      })
      .optional(),
    expoBuildUrl: z.string().url().optional(),
    githubTriggerOptions: z
      .object({
        autoSubmit: z.boolean().default(false),
        submitProfile: z.string().optional(),
      })
      .optional(),
    loggerLevel: z.nativeEnum(LoggerLevel).optional(),

    initiatingUserId: z.string(),
    appId: z.string(),

    environment: z.string().optional(),

    workflowInterpolationContext: StaticWorkflowInterpolationContextZ.optional(),
  })
  .and(
    z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal(BuildMode.RESIGN),
        type: z.nativeEnum(Workflow).optional(),
        resign: z.object({
          applicationArchiveSource: ArchiveSourceZ,
        }),
        projectRootDirectory: z.string().optional(),
        secrets: SecretsZ.optional(),
      }),
      z.object({
        mode: z.literal(BuildMode.BUILD),
        type: z.nativeEnum(Workflow),
        resign: z.undefined(),
        projectRootDirectory: z.string(),
        secrets: SecretsZ,
      }),
      z.object({
        mode: z.literal(BuildMode.CUSTOM),
        type: z.nativeEnum(Workflow),
        resign: z.undefined(),
        projectRootDirectory: z.string(),
        secrets: SecretsZ.optional(),
      }),
      z.object({
        mode: z.literal(BuildMode.REPACK),
        type: z.nativeEnum(Workflow),
        resign: z.undefined(),
        projectRootDirectory: z.string(),
        secrets: SecretsZ,
      }),
    ])
  )
  .and(
    z.discriminatedUnion('triggeredBy', [
      z.object({
        triggeredBy: z.literal(BuildTrigger.GIT_BASED_INTEGRATION),
        buildProfile: z.string(),
      }),
      z.object({
        triggeredBy: z.literal(BuildTrigger.EAS_CLI),
        buildProfile: z.string().optional(),
      }),
    ])
  )
  .and(CustomBuildConfigZ);
