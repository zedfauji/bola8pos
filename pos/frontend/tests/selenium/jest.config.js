module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/selenium/tests/**/*.test.js'],
  testTimeout: 30000, // 30 seconds
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/tests/selenium/utils/setup.js'],
  globalSetup: '<rootDir>/tests/selenium/utils/globalSetup.js',
  globalTeardown: '<rootDir>/tests/selenium/utils/globalTeardown.js',
};
