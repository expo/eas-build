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

export interface Keystore {
  dataBase64: string;
  keystorePassword: string;
  keyAlias: string;
  keyPassword: string;
}

const KeystoreSchema = Joi.object({
  dataBase64: Joi.string().required(),
  keystorePassword: Joi.string().required(),
  keyAlias: Joi.string().required(),
  keyPassword: Joi.string().required(),
});

export const builderBaseImages = [
  'default',
  'latest',
  'stable',
  'ubuntu-18.04-android-30-ndk-r19c',
] as const;

export interface BuilderEnvironment {
  image: typeof builderBaseImages[number];
  node?: string;
  yarn?: string;
  ndk?: string;
  env?: Env;
}

const BuilderEnvironmentSchema = Joi.object({
  image: Joi.string()
    .valid(...builderBaseImages)
    .default('default'),
  node: Joi.string(),
  yarn: Joi.string(),
  ndk: Joi.string(),
  env: EnvSchema,
});

interface BaseJob {
  projectArchive: ArchiveSource;
  platform: Platform.ANDROID;
  projectRootDirectory: string;
  releaseChannel?: string;
  secrets: {
    buildCredentials?: {
      keystore: Keystore;
    };
    environmentSecrets?: Env;
  };
  builderEnvironment?: BuilderEnvironment;
  cache: Cache;
}

const BaseJobSchema = Joi.object({
  projectArchive: ArchiveSourceSchema.required(),
  platform: Joi.string().valid(Platform.ANDROID).required(),
  projectRootDirectory: Joi.string().required(),
  releaseChannel: Joi.string(),
  secrets: Joi.object({
    buildCredentials: Joi.object({ keystore: KeystoreSchema.required() }),
    environmentSecrets: EnvSchema,
  }).required(),
  builderEnvironment: BuilderEnvironmentSchema,
  cache: CacheSchema.default(),
});

export interface GenericJob extends BaseJob {
  type: Workflow.GENERIC;
  gradleCommand: string;
  artifactPath: string;
}

export const GenericJobSchema = BaseJobSchema.concat(
  Joi.object({
    type: Joi.string().valid(Workflow.GENERIC),
    gradleCommand: Joi.string().default(':app:bundleRelease'),
    artifactPath: Joi.string().default('android/app/build/outputs/**/*.{apk,aab}'),
  })
);

export enum ManagedBuildType {
  APK = 'apk',
  APP_BUNDLE = 'app-bundle',
  DEVELOPMENT_CLIENT = 'development-client',
}

export interface ManagedJob extends BaseJob {
  type: Workflow.MANAGED;
  buildType: ManagedBuildType;
  username?: string;
}

export const ManagedJobSchema = BaseJobSchema.concat(
  Joi.object().keys({
    type: Joi.string().valid(Workflow.MANAGED),
    buildType: Joi.string()
      .valid(...Object.values(ManagedBuildType))
      .default(ManagedBuildType.APP_BUNDLE),
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
