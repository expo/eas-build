import { type bunyan } from '@expo/logger';

import { createGlobalContextMock } from '../../../__tests__/utils/context';
import { createBunyanLoggerAdapter, createRepackBuildFunction } from '../repack';

jest.mock('@expo/repack-app');

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
  });

  it('should set the output path for successful repack', async () => {
    const repack = createRepackBuildFunction();
    const repackStep = repack.createBuildStepFromFunctionCall(createGlobalContextMock({}), {
      callInputs: {
        platform: 'ios',
        source_app_path: '/path/to/source_app',
        output_path: '/path/to/output_app',
      },
    });

    await repackStep.executeAsync();
    expect(repackStep.outputById['output_path'].value).toBe('/path/to/output_app');
  });

  it('should throw for unsupported platforms', async () => {
    const repack = createRepackBuildFunction();
    const repackStep = repack.createBuildStepFromFunctionCall(createGlobalContextMock({}), {
      callInputs: {
        platform: 'unknown',
        source_app_path: '/path/to/source_app',
      },
    });

    await expect(repackStep.executeAsync()).rejects.toThrow(/Unsupported platform/);
  });
});
