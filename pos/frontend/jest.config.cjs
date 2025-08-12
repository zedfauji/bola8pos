/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/test/jest.setup.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'] }],
  },
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^css\\.escape$': '<rootDir>/src/shims/css.escape.ts',
    '\\.(css|less|scss)$': 'identity-obj-proxy',
  },
  testMatch: ['**/__tests__/**/*.jest.test.[jt]s?(x)'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
};
