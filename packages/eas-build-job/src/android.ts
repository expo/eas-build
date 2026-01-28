import Joi from 'joi';
import { z } from 'zod';
import { LoggerLevel } from '@expo/logger';

import {
  ArchiveSource,
  ArchiveSourceSchema,
  ArchiveSourceZ,
  Env,
  EnvSchema,
  EnvZ,
  Platform,
  Workflow,
  Cache,
  CacheSchema,
  CacheZ,
  EnvironmentSecretsSchema,
  EnvironmentSecretsZ,
  EnvironmentSecret,
  BuildTrigger,
  BuildMode,
  StaticWorkflowInterpolationContextZ,
  StaticWorkflowInterpolationContext,
  CustomBuildConfigSchema,
  CustomBuildConfigZ,
} from './common';
import { Step } from './step';

export interface Keystore {
  dataBase64: string;
  keystorePassword: string;
  keyAlias: string;
  keyPassword?: string;
}

const KeystoreSchema = Joi.object({
  dataBase64: Joi.string().required(),
  keystorePassword: Joi.string().allow('').required(),
  keyAlias: Joi.string().required(),
  keyPassword: Joi.string().allow(''),
});

const KeystoreZ = z.object({
  dataBase64: z.string(),
  keystorePassword: z.string(),
  keyAlias: z.string(),
  keyPassword: z.string().optional(),
});

export enum BuildType {
  APK = 'apk',
  APP_BUNDLE = 'app-bundle',
}

export interface BuilderEnvironment {
  image?: string;
  node?: string;
  corepack?: boolean;
  pnpm?: string;
  yarn?: string;
  bun?: string;
  ndk?: string;
  env?: Env;
}

const BuilderEnvironmentSchema = Joi.object({
  image: Joi.string(),
  node: Joi.string(),
  corepack: Joi.boolean(),
  yarn: Joi.string(),
  pnpm: Joi.string(),
  bun: Joi.string(),
  ndk: Joi.string(),
  env: EnvSchema,
});

const BuilderEnvironmentZ = z.object({
  image: z.string().optional(),
  node: z.string().optional(),
  corepack: z.boolean().optional(),
  yarn: z.string().optional(),
  pnpm: z.string().optional(),
  bun: z.string().optional(),
  ndk: z.string().optional(),
  env: EnvZ.optional(),
});

export interface BuildSecrets {
  buildCredentials?: {
    keystore: Keystore;
  };
  environmentSecrets?: EnvironmentSecret[];
  robotAccessToken?: string;
}

export interface Job {
  mode: BuildMode;
  type: Workflow;
  triggeredBy: BuildTrigger;
  projectArchive: ArchiveSource;
  platform: Platform.ANDROID;
  projectRootDirectory: string;
  buildProfile?: string;
  updates?: {
    channel?: string;
  };
  secrets?: BuildSecrets;
  builderEnvironment?: BuilderEnvironment;
  cache?: Cache;
  developmentClient?: boolean;
  version?: {
    versionCode?: string;
    /**
     * support for this field is implemented, but specifying it is disabled on schema level
     */
    versionName?: string;
    /**
     * support for this field is implemented, but specifying it is disabled on schema level
     */
    runtimeVersion?: string;
  };
  buildArtifactPaths?: string[];

  gradleCommand?: string;
  applicationArchivePath?: string;

  buildType?: BuildType;
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

const SecretsSchema = Joi.object({
  buildCredentials: Joi.object({ keystore: KeystoreSchema.required() }),
  environmentSecrets: EnvironmentSecretsSchema,
  robotAccessToken: Joi.string(),
});

const SecretsZ = z.object({
  buildCredentials: z.object({ keystore: KeystoreZ }).optional(),
  environmentSecrets: EnvironmentSecretsZ.optional(),
  robotAccessToken: z.string().optional(),
});

export const JobSchema = Joi.object({
  mode: Joi.string()
    .valid(BuildMode.BUILD, BuildMode.CUSTOM, BuildMode.REPACK)
    .default(BuildMode.BUILD),
  type: Joi.string()
    .valid(...Object.values(Workflow))
    .required(),
  triggeredBy: Joi.string()
    .valid(...Object.values(BuildTrigger))
    .default(BuildTrigger.EAS_CLI),
  projectArchive: ArchiveSourceSchema.required(),
  platform: Joi.string().valid(Platform.ANDROID).required(),
  projectRootDirectory: Joi.string().required(),
  buildProfile: Joi.when('triggeredBy', {
    is: BuildTrigger.GIT_BASED_INTEGRATION,
    then: Joi.string().required(),
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
  version: Joi.object({
    versionCode: Joi.string().regex(/^\d+$/),
  }),
  buildArtifactPaths: Joi.array().items(Joi.string()),

  gradleCommand: Joi.string(),
  applicationArchivePath: Joi.string(),

  buildType: Joi.string().valid(...Object.values(BuildType)),
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
    type: z.nativeEnum(Workflow),
    projectArchive: ArchiveSourceZ,
    platform: z.literal(Platform.ANDROID),
    projectRootDirectory: z.string(),
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
    version: z
      .object({
        versionCode: z.string().regex(/^\d+$/).optional(),
      })
      .optional(),
    buildArtifactPaths: z.array(z.string()).optional(),

    gradleCommand: z.string().optional(),
    applicationArchivePath: z.string().optional(),

    buildType: z.nativeEnum(BuildType).optional(),
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
  .and(CustomBuildConfigZ)
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
  .and(
    z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal(BuildMode.CUSTOM),
        secrets: SecretsZ.optional(),
      }),
      z.object({
        mode: z.literal(BuildMode.BUILD),
        secrets: SecretsZ,
      }),
      z.object({
        mode: z.literal(BuildMode.REPACK),
        secrets: SecretsZ,
      }),
    ])
  );
