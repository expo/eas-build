import { MetadataSchema } from '../metadata';

describe('MetadataSchema', () => {
  test('valid metadata', () => {
    const metadata = {
      appName: 'testapp',
      appVersion: '1.0.0',
      cliVersion: '1.2.3',
      buildProfile: 'release',
      credentialsSource: 'remote',
      distribution: 'store',
      gitCommitHash: '752e99d2b8fde1bf07ebb8af1b4a3c26a6703943',
      trackingContext: {},
      workflow: 'generic',
      username: 'notdominik',
      versionCode: 123,
      buildNumber: '123',
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
      cliVersion: '1.2.3',
      buildProfile: 'release',
      credentialsSource: 'blah',
      distribution: 'store',
      gitCommitHash: 'inv4lid-h@sh',
      trackingContext: {},
      workflow: 'generic',
      username: 'notdominik',
      versionCode: 123,
      buildNumber: '123',
    };
    const { error } = MetadataSchema.validate(metadata, {
      stripUnknown: true,
      convert: true,
      abortEarly: false,
    });
    expect(error?.message).toEqual(
      '"credentialsSource" must be one of [local, remote]. "gitCommitHash" length must be 40 characters long. "gitCommitHash" must only contain hexadecimal characters'
    );
  });
});
