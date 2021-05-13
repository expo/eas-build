import Joi from '@hapi/joi';

import * as Android from '../android';
import { ArchiveSourceType, Platform, Workflow } from '../common';

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

describe('Android.GenericJobSchema', () => {
  test('valid job', () => {
    const genericJob = {
      secrets,
      platform: Platform.ANDROID,
      type: Workflow.GENERIC,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'http://localhost:3000',
      },
      gradleCommand: ':app:bundleRelease',
      artifactPath: 'android/app/build/outputs/bundle/release/app-release.aab',
      projectRootDirectory: '.',
      releaseChannel: 'default',
      builderEnvironment: {
        image: 'default',
        node: '1.2.3',
        yarn: '2.3.4',
        ndk: '4.5.6',
        env: {
          SOME_ENV: '123',
        },
      },
    };

    const { value, error } = Android.GenericJobSchema.validate(genericJob, joiOptions);
    expect(value).toMatchObject(genericJob);
    expect(error).toBeFalsy();
  });

  test('invalid job', () => {
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

    const { value, error } = Android.GenericJobSchema.validate(genericJob, joiOptions);
    expect(error?.message).toBe(
      '"projectArchive.url" must be a valid uri. "gradleCommand" must be a string'
    );
    expect(value).not.toMatchObject(genericJob);
  });
});

describe('Android.ManagedJobSchema', () => {
  test('valid job', () => {
    const managedJob = {
      secrets,
      platform: Platform.ANDROID,
      type: Workflow.MANAGED,
      buildType: Android.ManagedBuildType.APP_BUNDLE,
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
        env: {
          SOME_ENV: '123',
        },
      },
    };

    const { value, error } = Android.ManagedJobSchema.validate(managedJob, joiOptions);
    expect(value).toMatchObject(managedJob);
    expect(error).toBeFalsy();
  });

  test('invalid job', () => {
    const managedJob = {
      secrets,
      platform: Platform.ANDROID,
      type: Workflow.MANAGED,
      buildType: Android.ManagedBuildType.APP_BUNDLE,
      username: 3,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'url',
      },
      projectRootDirectory: '.',
      uknownField: 'field',
    };

    const { value, error } = Android.ManagedJobSchema.validate(managedJob, joiOptions);
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

    const { value, error } = Android.ManagedJobSchema.validate(managedJob, joiOptions);
    expect(value).toMatchObject(managedJob);
    expect(error).toBeFalsy();
  });
  test('fails when both releaseChannel and updates.channel are defined.', () => {
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

    const { error } = Android.ManagedJobSchema.validate(managedJob, joiOptions);
    expect(error?.message).toBe(
      '"value" contains a conflict between optional exclusive peers [releaseChannel, updates.channel]'
    );
  });
});
