module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: [
    '**/__unit__/*.test.ts',
    ...(process.platform === 'darwin' ? ['**/__unit__/*.test.ios.ts'] : []),
  ],
  collectCoverage: true,
  coverageReporters: ['json', 'lcov'],
  coverageDirectory: '../coverage/unit-tests/',
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/../jest/unit-setup.ts'],
};
