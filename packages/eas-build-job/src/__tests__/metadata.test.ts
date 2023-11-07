import { MetadataSchema } from '../metadata';

describe('MetadataSchema', () => {
  test('valid metadata', () => {
    const metadata = {
      appName: 'testapp',
      appVersion: '1.0.0',
      appBuildVersion: '123',
      runtimeVersion: '3.2.1',
      cliVersion: '1.2.3',
      buildProfile: 'release',
      credentialsSource: 'remote',
      distribution: 'store',
      gitCommitHash: '752e99d2b8fde1bf07ebb8af1b4a3c26a6703943',
      gitCommitMessage: 'Lorem ipsum',
      trackingContext: {},
      workflow: 'generic',
      username: 'notdominik',
      iosEnterpriseProvisioning: 'adhoc',
      message: 'fix foo, bar, and baz',
      runFromCI: true,
      runWithNoWaitFlag: true,
      buildMode: 'build',
      customWorkflowName: 'blah blah',
      developmentClient: true,
      requiredPackageManager: 'yarn',
      simulator: true,
      selectedImage: 'default',
    };
    const { value, error } = MetadataSchema.validate(metadata, {
      stripUnknown: true,
      convert: true,
      abortEarly: false,
    });
    expect(error).toBeFalsy();
    expect(value).toEqual(metadata);
  });
  test('invalid metadata', () => {
    const metadata = {
      appName: 'testapp',
      appVersion: '1.0.0',
      appBuildVersion: '123',
      runtimeVersion: '3.2.1',
      cliVersion: '1.2.3',
      buildProfile: 'release',
      credentialsSource: 'blah',
      distribution: 'store',
      gitCommitHash: 'inv4lid-h@sh',
      gitCommitMessage: 'a'.repeat(4097),
      trackingContext: {},
      workflow: 'generic',
      username: 'notdominik',
      message: 'a'.repeat(1025),
      runFromCI: true,
      runWithNoWaitFlag: true,
      buildMode: 'resign',
      customWorkflowName: 'blah blah',
      developmentClient: true,
      requiredPackageManager: 'yarn',
      simulator: false,
      selectedImage: 'default',
    };
    const { error } = MetadataSchema.validate(metadata, {
      stripUnknown: true,
      convert: true,
      abortEarly: false,
    });
    expect(error?.message).toEqual(
      '"credentialsSource" must be one of [local, remote]. "gitCommitHash" length must be 40 characters long. "gitCommitHash" must only contain hexadecimal characters. "gitCommitMessage" length must be less than or equal to 4096 characters long. "message" length must be less than or equal to 1024 characters long'
    );
  });
});
