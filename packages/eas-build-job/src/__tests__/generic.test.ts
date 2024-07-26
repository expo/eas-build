import { ArchiveSourceType, BuildTrigger, EnvironmentSecretType } from '../common';
import { Generic } from '../generic';

describe('Generic.JobZ', () => {
  it('accepts valid customBuildConfig.path job', () => {
    const job = {
      projectArchive: {
        type: ArchiveSourceType.GIT,
        repositoryUrl: 'https://github.com/expo/expo.git',
        gitCommitHash: '1234567890',
        gitRef: null,
      },
      customBuildConfig: {
        path: 'path/to/custom-build-config.yml',
      },
      secrets: {
        robotAccessToken: 'token',
        environmentSecrets: [
          {
            name: 'secret-name',
            value: 'secret-value',
            type: EnvironmentSecretType.STRING,
          },
        ],
      },
      expoDevUrl: 'https://expo.dev/accounts/name/builds/id',
      builderEnvironment: {
        image: 'macos-sonoma-14.5-xcode-15.4',
        node: '20.15.1',
        env: {
          KEY1: 'value1',
        },
      },
      triggeredBy: BuildTrigger.GIT_BASED_INTEGRATION,
    };
    expect(Generic.JobZ.parse(job)).toEqual(job);
  });

  it('accepts valid steps job', () => {
    const job = {
      projectArchive: {
        type: ArchiveSourceType.GIT,
        repositoryUrl: 'https://github.com/expo/expo.git',
        gitCommitHash: '1234567890',
        gitRef: null,
      },
      steps: [
        {
          id: 'step1',
          name: 'Step 1',
          run: 'echo Hello, world!',
          shell: 'sh',
          env: {
            KEY1: 'value1',
          },
        },
      ],
      secrets: {
        robotAccessToken: 'token',
        environmentSecrets: [
          {
            name: 'secret-name',
            value: 'secret-value',
            type: EnvironmentSecretType.STRING,
          },
        ],
      },
      expoDevUrl: 'https://expo.dev/accounts/name/builds/id',
      builderEnvironment: {
        image: 'macos-sonoma-14.5-xcode-15.4',
        node: '20.15.1',
        env: {
          KEY1: 'value1',
        },
      },
      triggeredBy: BuildTrigger.GIT_BASED_INTEGRATION,
    };
    expect(Generic.JobZ.parse(job)).toEqual(job);
  });

  it('errors when neither customBuildConfig.path nor steps are provided', () => {
    const job = {
      projectArchive: {
        type: ArchiveSourceType.GIT,
        repositoryUrl: 'https://github.com/expo/expo.git',
        gitCommitHash: '1234567890',
        gitRef: null,
      },
      secrets: {
        robotAccessToken: 'token',
        environmentSecrets: [
          {
            name: 'secret-name',
            value: 'secret-value',
            type: EnvironmentSecretType.STRING,
          },
        ],
      },
      expoDevUrl: 'https://expo.dev/accounts/name/builds/id',
      builderEnvironment: {
        image: 'macos-sonoma-14.5-xcode-15.4',
        node: '20.15.1',
        env: {
          KEY1: 'value1',
        },
      },
      triggeredBy: BuildTrigger.GIT_BASED_INTEGRATION,
    };
    expect(() => Generic.JobZ.parse(job)).toThrow('Invalid input');
  });

  it('errors when both customBuildConfig.path and steps are provided', () => {
    const job = {
      projectArchive: {
        type: ArchiveSourceType.GIT,
        repositoryUrl: 'https://github.com/expo/expo.git',
        gitCommitHash: '1234567890',
        gitRef: null,
      },
      secrets: {
        robotAccessToken: 'token',
        environmentSecrets: [
          {
            name: 'secret-name',
            value: 'secret-value',
            type: EnvironmentSecretType.STRING,
          },
        ],
      },
      expoDevUrl: 'https://expo.dev/accounts/name/builds/id',
      builderEnvironment: {
        image: 'macos-sonoma-14.5-xcode-15.4',
        node: '20.15.1',
        env: {
          KEY1: 'value1',
        },
      },
      triggeredBy: BuildTrigger.GIT_BASED_INTEGRATION,
      customBuildConfig: {
        path: 'path/to/custom-build-config.yml',
      },
      steps: [
        {
          id: 'step1',
          name: 'Step 1',
          run: 'echo Hello, world!',
          shell: 'sh',
          env: {
            KEY1: 'value1',
          },
        },
      ],
    };
    expect(() => Generic.JobZ.parse(job)).toThrow('Invalid input');
  });
});
