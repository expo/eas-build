import path from 'node:path';

import { type bunyan } from '@expo/logger';
import fg from 'fast-glob';
import { vol } from 'memfs';

import { createGlobalContextMock } from '../../../__tests__/utils/context';
import { createTestAndroidJob, createTestIosJob } from '../../../__tests__/utils/job';
import IosCredentialsManager from '../../utils/ios/credentials/manager';
import {
  createBunyanLoggerAdapter,
  createRepackBuildFunction,
  resolveAndroidSigningOptionsAsync,
  resolveIosSigningOptionsAsync,
} from '../repack';
import ProvisioningProfile, {
  DistributionType,
} from '../../utils/ios/credentials/provisioningProfile';

jest.mock('fs');
jest.mock('@expo/repack-app');
jest.mock('../../utils/ios/credentials/manager');

describe(createBunyanLoggerAdapter, () => {
  it('should create a logger that calls the Bunyan logger methods', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as bunyan;

    const logger = createBunyanLoggerAdapter(mockLogger);

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');

    expect(mockLogger.debug).toHaveBeenCalledWith('Debug message');
    expect(mockLogger.info).toHaveBeenCalledWith('Info message');
    expect(mockLogger.warn).toHaveBeenCalledWith('Warn message');
    expect(mockLogger.error).toHaveBeenCalledWith('Error message');

    logger.time('Test timer');
    logger.timeEnd('Test timer');
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringMatching(/Test timer: \d+ ms/));
  });
});

describe(createRepackBuildFunction, () => {
  afterEach(() => {
    jest.restoreAllMocks();
    vol.reset();
  });

  it('should set the output path for successful repack', async () => {
    const repack = createRepackBuildFunction();
    const repackStep = repack.createBuildStepFromFunctionCall(
      createGlobalContextMock({
        staticContextContent: {
          job: {},
        },
      }),
      {
        callInputs: {
          platform: 'ios',
          source_app_path: '/path/to/source_app',
          output_path: '/path/to/output_app',
        },
      }
    );

    await repackStep.executeAsync();
    expect(repackStep.outputById['output_path'].value).toBe('/path/to/output_app');
  });

  it('should throw for unsupported platforms', async () => {
    const repack = createRepackBuildFunction();
    const repackStep = repack.createBuildStepFromFunctionCall(
      createGlobalContextMock({
        staticContextContent: {
          job: {},
        },
      }),
      {
        callInputs: {
          platform: 'unknown',
          source_app_path: '/path/to/source_app',
        },
      }
    );

    await expect(repackStep.executeAsync()).rejects.toThrow(/Unsupported platform/);
  });

  it('should cleanup android keystore files after execution', async () => {
    const repack = createRepackBuildFunction();
    const repackStep = repack.createBuildStepFromFunctionCall(
      createGlobalContextMock({
        staticContextContent: {
          job: createTestAndroidJob(),
        },
      }),
      {
        callInputs: {
          platform: 'android',
          source_app_path: '/path/to/source_app',
        },
      }
    );

    await repackStep.executeAsync();
    const tmpDir = path.dirname(repackStep.outputById['output_path'].value as string);
    const keystoreFiles = await fg(`${tmpDir}/keystore*`, { onlyFiles: true });
    expect(keystoreFiles.length).toBe(0);
  });
});

describe(resolveAndroidSigningOptionsAsync, () => {
  afterEach(() => {
    jest.restoreAllMocks();
    vol.reset();
  });

  it('should resolve android signing options', async () => {
    const job = createTestAndroidJob();
    const tmpDir = '/tmp';
    vol.mkdirSync(tmpDir, { recursive: true });
    const tmpFiles: string[] = [];
    const signingOptions = await resolveAndroidSigningOptionsAsync({
      job,
      tmpDir: '/tmp',
      tmpFiles,
    });

    expect(signingOptions).not.toBeNull();
    expect(signingOptions?.keyStorePath).toMatch(/\/tmp\/keystore/);
    expect(signingOptions?.keyStorePassword).toEqual(
      `pass:${job.secrets?.buildCredentials?.keystore.keystorePassword}`
    );
    expect(signingOptions?.keyAlias).toEqual(job.secrets?.buildCredentials?.keystore.keyAlias);
    expect(signingOptions?.keyPassword).toEqual(
      `pass:${job.secrets?.buildCredentials?.keystore.keyPassword}`
    );
    expect(tmpFiles).toContain(signingOptions?.keyStorePath);
  });

  it('should return undefined if no build credentials are provided', async () => {
    // @ts-expect-error: createTestAndroidJob does not support buildCredentials as null
    const job = createTestAndroidJob({ buildCredentials: null });
    const signingOptions = await resolveAndroidSigningOptionsAsync({
      job,
      tmpDir: '/tmp',
      tmpFiles: [],
    });
    expect(signingOptions).toBeUndefined();
  });
});

describe(resolveIosSigningOptionsAsync, () => {
  afterEach(() => {
    jest.restoreAllMocks();
    vol.reset();
  });

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as bunyan;

  it('should resolve ios signing options', async () => {
    const job = createTestIosJob();
    const credentialsManagerSpy = jest.spyOn(IosCredentialsManager.prototype, 'prepare');
    const mockProvisioningProfile = new ProvisioningProfile(
      Buffer.from('test-profile'),
      '/tmp/ios_provisioning_profile',
      'testapp',
      'Test App Certificate'
    );
    const provisioningProfileData = {
      path: '/tmp/ios_provisioning_profile',
      target: 'testapp',
      bundleIdentifier: 'com.example.testapp',
      teamId: 'TEAMID123',
      uuid: 'UUID123',
      name: 'Test App Provisioning Profile',
      distributionType: DistributionType.AD_HOC,
      developerCertificate: Buffer.from('test-developer-certificate'),
      certificateCommonName: 'Test App Certificate',
    };
    jest.spyOn(mockProvisioningProfile, 'data', 'get').mockReturnValue(provisioningProfileData);
    credentialsManagerSpy.mockResolvedValue({
      applicationTargetProvisioningProfile: mockProvisioningProfile,
      keychainPath: '/tmp/ios_keychain',
      targetProvisioningProfiles: {
        testapp: provisioningProfileData,
      },
      distributionType: DistributionType.AD_HOC,
      teamId: 'TEAMID123',
    });

    const signingOptions = await resolveIosSigningOptionsAsync({
      job,
      logger: mockLogger,
    });

    expect(signingOptions).not.toBeNull();
    expect(signingOptions?.keychainPath).toEqual('/tmp/ios_keychain');
    expect(signingOptions?.signingIdentity).toEqual('Test App Certificate');
    expect(signingOptions?.provisioningProfile).toEqual({
      'com.example.testapp': '/tmp/ios_provisioning_profile',
    });
  });

  it('should return undefined if no build credentials are provided', async () => {
    // @ts-expect-error: createTestIosJob does not support buildCredentials as null
    const job = createTestIosJob({ buildCredentials: null });
    const signingOptions = await resolveIosSigningOptionsAsync({
      job,
      logger: mockLogger,
    });
    expect(signingOptions).toBeUndefined();
  });

  it('should return undefined if the job is for a simulator', async () => {
    const job = createTestIosJob();
    job.simulator = true; // Simulate a job for the iOS simulator
    const signingOptions = await resolveIosSigningOptionsAsync({
      job,
      logger: mockLogger,
    });
    expect(signingOptions).toBeUndefined();
  });
});
