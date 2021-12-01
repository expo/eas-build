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

export enum BuildType {
  APK = 'apk',
  APP_BUNDLE = 'app-bundle',
}

export const builderBaseImages = [
  'default',
  'latest',
  'stable',
  'ubuntu-18.04-android-30-ndk-r19c', // legacy naming (image with java 8)
  'ubuntu-20.04-android-30-ndk-r21e', // legacy naming (image with java 8)
  'ubuntu-18.04-jdk-8-ndk-r19c',
  'ubuntu-18.04-jdk-11-ndk-r19c',
  'ubuntu-20.04-jdk-8-ndk-r21e',
  'ubuntu-20.04-jdk-11-ndk-r21e',
] as const;

export const reactNativeToDefaultBuilderImage: Record<string, typeof builderBaseImages[number]> = {
  '>=0.68.0.': 'ubuntu-18.04-jdk-11-ndk-r19c',
  '<0.68.0': 'ubuntu-18.04-jdk-8-ndk-r19c',
};

export interface BuilderEnvironment {
  image?: typeof builderBaseImages[number];
  node?: string;
  yarn?: string;
  expoCli?: string;
  ndk?: string;
  env?: Env;
}

const BuilderEnvironmentSchema = Joi.object({
  image: Joi.string()
    .valid(...builderBaseImages)
    .default('default'),
  node: Joi.string(),
  yarn: Joi.string(),
  expoCli: Joi.string(),
  ndk: Joi.string(),
  env: EnvSchema,
});

export interface Job {
  type: Workflow;
  projectArchive: ArchiveSource;
  platform: Platform.ANDROID;
  projectRootDirectory: string;
  releaseChannel?: string;
  updates?: {
    channel?: string;
  };
  secrets: {
    buildCredentials?: {
      keystore: Keystore;
    };
    environmentSecrets?: Env;
  };
  builderEnvironment?: BuilderEnvironment;
  cache: Cache;
  developmentClient?: boolean;

  // generic
  gradleCommand?: string;
  artifactPath?: string;

  // managed
  buildType?: BuildType;
  username?: string;
}

export const JobSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(Workflow))
    .required(),
  projectArchive: ArchiveSourceSchema.required(),
  platform: Joi.string().valid(Platform.ANDROID).required(),
  projectRootDirectory: Joi.string().required(),
  releaseChannel: Joi.string(),
  updates: Joi.object({
    channel: Joi.string(),
  }),
  secrets: Joi.object({
    buildCredentials: Joi.object({ keystore: KeystoreSchema.required() }),
    environmentSecrets: EnvSchema,
  }).required(),
  builderEnvironment: BuilderEnvironmentSchema,
  cache: CacheSchema.default(),
  developmentClient: Joi.boolean(),

  gradleCommand: Joi.string(),
  artifactPath: Joi.string(),

  buildType: Joi.string().valid(...Object.values(BuildType)),
  username: Joi.string(),
}).oxor('releaseChannel', 'updates.channel');
