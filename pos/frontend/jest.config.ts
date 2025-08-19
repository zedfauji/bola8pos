import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/test/jest.setup.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'] }],
  },
  moduleNameMapper: {
    // Map css.escape to local shim
    '^css\\.escape$': '<rootDir>/src/shims/css.escape.ts',
    // Static assets/CSS to identity proxy
    '\\.(css|less|scss)$': 'identity-obj-proxy',
  },
};

export default config;
