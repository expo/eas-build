import { type bunyan } from '@expo/logger';
import { Platform, type Job } from '@expo/eas-build-job';

import { createBunyanLoggerAdapter, createDefaultOutputPath } from '../repack';

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

describe(createDefaultOutputPath, () => {
  const tmpDir = '/tmp';

  it('should return repacked.apk for android', () => {
    const job = {
      platform: Platform.ANDROID,
    } as unknown as Job;
    const outputPath = createDefaultOutputPath({ tmpDir, job });
    expect(outputPath).toBe('/tmp/repacked.apk');
  });

  it('should return repacked.ipa for ios devices', () => {
    const job = {
      platform: Platform.IOS,
      simulator: false,
    } as unknown as Job;
    const outputPath = createDefaultOutputPath({ tmpDir, job });
    expect(outputPath).toBe('/tmp/repacked.ipa');
  });

  it('should return repacked.app for ios simulators', () => {
    const job = {
      platform: Platform.IOS,
      simulator: true,
    } as unknown as Job;
    const outputPath = createDefaultOutputPath({ tmpDir, job });
    expect(outputPath).toBe('/tmp/repacked.app');
  });
});
