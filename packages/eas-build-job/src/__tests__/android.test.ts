import Joi from 'joi';

import * as Android from '../android';
import { ArchiveSourceType, BuildMode, BuildTrigger, Platform, Workflow } from '../common';

const joiOptions: Joi.ValidationOptions = {
  stripUnknown: true,
  convert: true,
  abortEarly: false,
};

const secrets = {
  buildCredentials: {
    keystore: {
      dataBase64: 'MjEzNwo=',
      keystorePassword: 'pass1',
      keyAlias: 'alias',
      keyPassword: 'pass2',
    },
  },
};

describe('Android.JobSchema', () => {
  test('valid generic job', () => {
    const genericJob = {
      secrets,
      platform: Platform.ANDROID,
      type: Workflow.GENERIC,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'http://localhost:3000',
      },
      gradleCommand: ':app:bundleRelease',
      applicationArchivePath: 'android/app/build/outputs/bundle/release/app-release.aab',
      projectRootDirectory: '.',
      releaseChannel: 'default',
      builderEnvironment: {
        image: 'default',
        node: '1.2.3',
        yarn: '2.3.4',
        ndk: '4.5.6',
        bun: '1.0.0',
        env: {
          SOME_ENV: '123',
        },
      },
      expoBuildUrl: 'https://expo.dev/fake/build/url',
    };

    const { value, error } = Android.JobSchema.validate(genericJob, joiOptions);
    expect(value).toMatchObject(genericJob);
    expect(error).toBeFalsy();
  });

  test('valid generic job with metadataLocation', () => {
    const genericJob = {
      secrets,
      platform: Platform.ANDROID,
      type: Workflow.GENERIC,
      projectArchive: {
        type: ArchiveSourceType.GCS,
        bucketKey: 'path/to/file',
        metadataLocation: 'path/to/metadata',
      },
      gradleCommand: ':app:bundleRelease',
      applicationArchivePath: 'android/app/build/outputs/bundle/release/app-release.aab',
      projectRootDirectory: '.',
      releaseChannel: 'default',
      builderEnvironment: {
        image: 'default',
        node: '1.2.3',
        yarn: '2.3.4',
        ndk: '4.5.6',
        bun: '1.0.0',
        env: {
          SOME_ENV: '123',
        },
      },
    };

    const { value, error } = Android.JobSchema.validate(genericJob, joiOptions);
    expect(value).toMatchObject(genericJob);
    expect(error).toBeFalsy();
  });

  test('invalid generic job', () => {
    const genericJob = {
      secrets,
      platform: Platform.ANDROID,
      type: Workflow.GENERIC,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'url',
      },
      gradleCommand: 1,
      uknownField: 'field',
      projectRootDirectory: '.',
    };

    const { value, error } = Android.JobSchema.validate(genericJob, joiOptions);
    expect(error?.message).toBe(
      '"projectArchive.url" must be a valid uri. "gradleCommand" must be a string'
    );
    expect(value).not.toMatchObject(genericJob);
  });

  test('valid managed job', () => {
    const managedJob = {
      secrets,
      platform: Platform.ANDROID,
      type: Workflow.MANAGED,
      buildType: Android.BuildType.APP_BUNDLE,
      username: 'turtle-tutorial',
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'http://localhost:3000',
      },
      projectRootDirectory: '.',
      releaseChannel: 'default',
      builderEnvironment: {
        image: 'default',
        node: '1.2.3',
        yarn: '2.3.4',
        ndk: '4.5.6',
        bun: '1.0.0',
        env: {
          SOME_ENV: '123',
        },
      },
    };

    const { value, error } = Android.JobSchema.validate(managedJob, joiOptions);
    expect(value).toMatchObject(managedJob);
    expect(error).toBeFalsy();
  });

  test('invalid managed job', () => {
    const managedJob = {
      secrets,
      platform: Platform.ANDROID,
      type: Workflow.MANAGED,
      buildType: Android.BuildType.APP_BUNDLE,
      username: 3,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'url',
      },
      projectRootDirectory: '.',
      uknownField: 'field',
    };

    const { value, error } = Android.JobSchema.validate(managedJob, joiOptions);
    expect(error?.message).toBe(
      '"projectArchive.url" must be a valid uri. "username" must be a string'
    );
    expect(value).not.toMatchObject(managedJob);
  });

  test('validates channel', () => {
    const managedJob = {
      secrets,
      type: Workflow.MANAGED,
      platform: Platform.ANDROID,
      updates: {
        channel: 'main',
      },
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'http://localhost:3000',
      },
      projectRootDirectory: '.',
    };

    const { value, error } = Android.JobSchema.validate(managedJob, joiOptions);
    expect(value).toMatchObject(managedJob);
    expect(error).toBeFalsy();
  });

  test('fails when both releaseChannel and updates.channel are defined', () => {
    const managedJob = {
      secrets,
      type: Workflow.MANAGED,
      platform: Platform.ANDROID,
      releaseChannel: 'default',
      updates: {
        channel: 'main',
      },
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'http://localhost:3000',
      },
      projectRootDirectory: '.',
    };

    const { error } = Android.JobSchema.validate(managedJob, joiOptions);
    expect(error?.message).toBe(
      '"value" contains a conflict between optional exclusive peers [releaseChannel, updates.channel]'
    );
  });

  test('build from git without buildProfile defined', () => {
    const managedJob = {
      secrets,
      triggeredBy: BuildTrigger.GIT_BASED_INTEGRATION,
      platform: Platform.ANDROID,
      type: Workflow.MANAGED,
      buildType: Android.BuildType.APP_BUNDLE,
      username: 'turtle-tutorial',
      projectArchive: {
        type: ArchiveSourceType.GIT,
        repositoryUrl: 'http://localhost:3000',
        gitRef: 'master',
      },
      projectRootDirectory: '.',
      releaseChannel: 'default',
      builderEnvironment: {
        image: 'default',
      },
    };

    const { error } = Android.JobSchema.validate(managedJob, joiOptions);
    expect(error?.message).toBe('"buildProfile" is required');
  });

  test('valid custom build job', () => {
    const customBuildJob = {
      mode: BuildMode.CUSTOM,
      type: Workflow.UNKNOWN,
      platform: Platform.ANDROID,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'https://expo.dev/builds/123',
      },
      projectRootDirectory: '.',
      customBuildConfig: {
        path: 'production.android.yml',
      },
    };

    const { value, error } = Android.JobSchema.validate(customBuildJob, joiOptions);
    expect(value).toMatchObject(customBuildJob);
    expect(error).toBeFalsy();
  });

  test('can set github trigger options', () => {
    const job = {
      mode: BuildMode.CUSTOM,
      type: Workflow.UNKNOWN,
      platform: Platform.ANDROID,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'https://expo.dev/builds/123',
      },
      projectRootDirectory: '.',
      githubTriggerOptions: {
        autoSubmit: true,
        submitProfile: 'default',
      },
    };
    const { value, error } = Android.JobSchema.validate(job, joiOptions);
    expect(value).toMatchObject(job);
    expect(error).toBeFalsy();
  });
});
