import Joi from 'joi';

import { ArchiveSourceType, BuildMode, Platform, Workflow } from '../common';
import * as Ios from '../ios';

const joiOptions: Joi.ValidationOptions = {
  stripUnknown: true,
  convert: true,
  abortEarly: false,
};

const buildCredentials: Ios.BuildCredentials = {
  testapp: {
    distributionCertificate: {
      dataBase64: 'YmluYXJ5Y29udGVudDE=',
      password: 'distCertPassword',
    },
    provisioningProfileBase64: 'MnRuZXRub2N5cmFuaWI=',
  },
};

describe('Ios.JobSchema', () => {
  test('valid generic job', () => {
    const genericJob = {
      secrets: {
        buildCredentials,
      },
      type: Workflow.GENERIC,
      platform: Platform.IOS,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'http://localhost:3000',
      },
      projectRootDirectory: '.',
      scheme: 'testapp',
      buildConfiguration: 'Release',
      applicationArchivePath: 'ios/build/*.ipa',
      releaseChannel: 'default',
      builderEnvironment: {
        image: 'default',
        node: '1.2.3',
        yarn: '2.3.4',
        fastlane: '3.4.5',
        cocoapods: '4.5.6',
        env: {
          ENV_VAR: '123',
        },
      },
      expoBuildUrl: 'https://expo.dev/fake/build/url',
    };

    const { value, error } = Ios.JobSchema.validate(genericJob, joiOptions);
    expect(value).toMatchObject(genericJob);
    expect(error).toBeFalsy();
  });

  test('valid resign job', () => {
    const genericJob = {
      mode: BuildMode.RESIGN,
      secrets: {
        buildCredentials,
      },
      type: Workflow.UNKNOWN,
      platform: Platform.IOS,
      projectArchive: {
        type: ArchiveSourceType.NONE,
      },
      resign: {
        applicationArchiveSource: {
          type: ArchiveSourceType.URL,
          url: 'http://localhost:3000/a.ipa',
        },
      },
    };

    const { value, error } = Ios.JobSchema.validate(genericJob, joiOptions);
    expect(value).toMatchObject(genericJob);
    expect(error).toBeFalsy();
  });

  test('valid custom build job with metadataLocation', () => {
    const customBuildJob = {
      mode: BuildMode.CUSTOM,
      type: Workflow.UNKNOWN,
      platform: Platform.IOS,
      projectArchive: {
        type: ArchiveSourceType.GCS,
        bucketKey: 'path/to/file',
        metadataLocation: 'path/to/metadata',
      },
      projectRootDirectory: '.',
      customBuildConfig: {
        path: 'production.ios.yml',
      },
    };

    const { value, error } = Ios.JobSchema.validate(customBuildJob, joiOptions);
    expect(value).toMatchObject(customBuildJob);
    expect(error).toBeFalsy();
  });

  test('valid custom build job', () => {
    const customBuildJob = {
      mode: BuildMode.CUSTOM,
      type: Workflow.UNKNOWN,
      platform: Platform.IOS,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'https://expo.dev/builds/123',
      },
      projectRootDirectory: '.',
      customBuildConfig: {
        path: 'production.ios.yml',
      },
    };

    const { value, error } = Ios.JobSchema.validate(customBuildJob, joiOptions);
    expect(value).toMatchObject(customBuildJob);
    expect(error).toBeFalsy();
  });

  test('invalid generic job', () => {
    const genericJob = {
      secrets: {
        buildCredentials,
      },
      type: Workflow.GENERIC,
      platform: Platform.IOS,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'url',
      },
      projectRootDirectory: '.',
      uknownField: 'field',
    };

    const { value, error } = Ios.JobSchema.validate(genericJob, joiOptions);
    expect(error?.message).toBe('"projectArchive.url" must be a valid uri');
    expect(value).not.toMatchObject(genericJob);
  });

  test('valid managed job', () => {
    const managedJob = {
      secrets: {
        buildCredentials,
      },
      type: Workflow.MANAGED,
      platform: Platform.IOS,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'http://localhost:3000',
      },
      projectRootDirectory: '.',
      username: 'turtle-tutorial',
      releaseChannel: 'default',
      builderEnvironment: {
        image: 'default',
        node: '1.2.3',
        yarn: '2.3.4',
        fastlane: '3.4.5',
        cocoapods: '4.5.6',
        env: {
          ENV_VAR: '123',
        },
      },
    };

    const { value, error } = Ios.JobSchema.validate(managedJob, joiOptions);
    expect(value).toMatchObject(managedJob);
    expect(error).toBeFalsy();
  });

  test('invalid managed job', () => {
    const managedJob = {
      secrets: {
        buildCredentials,
      },
      type: Workflow.MANAGED,
      platform: Platform.IOS,
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'url',
      },
      projectRootDirectory: 312,
      uknownField: 'field',
    };

    const { value, error } = Ios.JobSchema.validate(managedJob, joiOptions);
    expect(error?.message).toBe(
      '"projectArchive.url" must be a valid uri. "projectRootDirectory" must be a string'
    );
    expect(value).not.toMatchObject(managedJob);
  });
  test('validates channel', () => {
    const managedJob = {
      secrets: {
        buildCredentials,
      },
      type: Workflow.MANAGED,
      platform: Platform.IOS,
      updates: {
        channel: 'main',
      },
      projectArchive: {
        type: ArchiveSourceType.URL,
        url: 'http://localhost:3000',
      },
      projectRootDirectory: '.',
    };

    const { value, error } = Ios.JobSchema.validate(managedJob, joiOptions);
    expect(value).toMatchObject(managedJob);
    expect(error).toBeFalsy();
  });
  test('fails when both releaseChannel and updates.channel are defined', () => {
    const managedJob = {
      secrets: {
        buildCredentials,
      },
      type: Workflow.MANAGED,
      platform: Platform.IOS,
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

    const { error } = Ios.JobSchema.validate(managedJob, joiOptions);
    expect(error?.message).toBe(
      '"value" contains a conflict between optional exclusive peers [releaseChannel, updates.channel]'
    );
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
    const { value, error } = Ios.JobSchema.validate(job, joiOptions);
    expect(value).toMatchObject(job);
    expect(error).toBeFalsy();
  });
});
