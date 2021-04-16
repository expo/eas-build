module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/__tests__/*.test.ts'],
  collectCoverage: true,
  coverageReporters: ['json', 'lcov'],
  coverageDirectory: '../coverage/tests/',
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/../jest/setup-tests.ts'],
};
