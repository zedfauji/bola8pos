module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/selenium/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.selenium.json',
      useESM: true,
    }],
  },
  testTimeout: 30000, // decreased per request; tests should be fast
  setupFilesAfterEnv: [
    '<rootDir>/tests/selenium/setup.ts',
    '@testing-library/jest-dom',
  ],
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results/jest',
      outputName: 'selenium-results.xml',
    }]
  ],
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironmentOptions: {
    url: 'http://localhost:5173',
  },
  // Guardrails to prevent Jest from hanging
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1,
};
