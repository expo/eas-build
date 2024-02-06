module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: [
    '**/__tests__/*.test.ts',
    ...(process.platform === 'darwin' ? ['**/__tests__/*.test.ios.ts'] : []),
  ],
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/../jest/setup-tests.ts'],
  globals: {
    fetch: global.fetch,
  },
};
