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
  BuildTrigger,
  BuildMode,
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
  'ubuntu-22.04-jdk-8-ndk-r21e',
  'ubuntu-22.04-jdk-11-ndk-r21e',
] as const;

export const imageMatchRules: ImageMatchRule<typeof builderBaseImages[number]>[] = [
  {
    image: 'ubuntu-18.04-jdk-11-ndk-r19c',
    reactNativeSemverRange: '>=0.68.0',
    sdkSemverRange: '<46',
  },
  {
    image: 'ubuntu-18.04-jdk-8-ndk-r19c',
    reactNativeSemverRange: '<0.68.0',
    sdkSemverRange: '<46',
  },
  {
    image: 'ubuntu-20.04-jdk-11-ndk-r21e',
    reactNativeSemverRange: '>=0.68.0',
    sdkSemverRange: '>=46',
  },
  {
    image: 'ubuntu-20.04-jdk-8-ndk-r21e',
    reactNativeSemverRange: '<0.68.0',
    sdkSemverRange: '>=46',
  },
];

export interface BuilderEnvironment {
  image?: typeof builderBaseImages[number];
  node?: string;
  yarn?: string;
  expoCli?: string;
  ndk?: string;
  env?: Env;
}

const BuilderEnvironmentSchema = Joi.object({
  image: Joi.string().valid(...builderBaseImages),
  node: Joi.string(),
  yarn: Joi.string(),
  expoCli: Joi.string(),
  ndk: Joi.string(),
  env: EnvSchema,
});

export interface Job {
  mode: BuildMode;
  type: Workflow;
  triggeredBy: BuildTrigger;
  projectArchive: ArchiveSource;
  platform: Platform.ANDROID;
  projectRootDirectory: string;
  buildProfile?: string;
  releaseChannel?: string;
  updates?: {
    channel?: string;
  };
  secrets: {
    buildCredentials?: {
      keystore: Keystore;
    };
    environmentSecrets?: EnvironmentSecret[];
    robotAccessToken?: string;
  };
  builderEnvironment?: BuilderEnvironment;
  cache: Cache;
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

  experimental?: {
    prebuildCommand?: string;
  };
}

export const JobSchema = Joi.object({
  mode: Joi.string().valid(BuildMode.BUILD).default(BuildMode.BUILD),
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
  releaseChannel: Joi.string(),
  updates: Joi.object({
    channel: Joi.string(),
  }),
  secrets: Joi.object({
    buildCredentials: Joi.object({ keystore: KeystoreSchema.required() }),
    environmentSecrets: EnvironmentSecretsSchema,
    robotAccessToken: Joi.string(),
  }).required(),
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
}).oxor('releaseChannel', 'updates.channel');
