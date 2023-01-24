import { bunyan } from '@expo/logger';

export function createMockLogger(): bunyan {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    child: jest.fn().mockImplementation(() => logger),
  } as unknown as bunyan;
  return logger;
}
