import Joi from '@hapi/joi';

import * as Ios from '../ios';
import { ArchiveSourceType, Platform, Workflow } from '../common';

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

describe('Ios.GenericJobSchema', () => {
  test('valid job', () => {
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
      distribution: 'store',
      scheme: 'testapp',
      schemeBuildConfiguration: Ios.SchemeBuildConfiguration.RELEASE,
      artifactPath: 'ios/build/*.ipa',
      releaseChannel: 'default',
      updatesRequestHeaders: { 'expo-channel-name': 'main' },
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

    const { value, error } = Ios.GenericJobSchema.validate(genericJob, joiOptions);
    expect(value).toMatchObject(genericJob);
    expect(error).toBeFalsy();
  });

  test('invalid job', () => {
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
      distribution: 'store',
      uknownField: 'field',
    };

    const { value, error } = Ios.GenericJobSchema.validate(genericJob, joiOptions);
    expect(error?.message).toBe('"projectArchive.url" must be a valid uri. "scheme" is required');
    expect(value).not.toMatchObject(genericJob);
  });
});

describe('Ios.ManagedJobSchema', () => {
  test('valid job', () => {
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
      distribution: 'store',
      buildType: Ios.ManagedBuildType.RELEASE,
      username: 'turtle-tutorial',
      releaseChannel: 'default',
      updatesRequestHeaders: { 'expo-channel-name': 'main' },
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

    const { value, error } = Ios.ManagedJobSchema.validate(managedJob, joiOptions);
    expect(value).toMatchObject(managedJob);
    expect(error).toBeFalsy();
  });

  test('invalid job', () => {
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
      distribution: 'store',
      uknownField: 'field',
    };

    const { value, error } = Ios.ManagedJobSchema.validate(managedJob, joiOptions);
    expect(error?.message).toBe(
      '"projectArchive.url" must be a valid uri. "projectRootDirectory" must be a string'
    );
    expect(value).not.toMatchObject(managedJob);
  });
});
