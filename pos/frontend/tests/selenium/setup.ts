// Set default test environment variables
process.env.TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Always quit WebDriver at the end to avoid hanging Jest
import { afterAll } from '@jest/globals';
import { WebDriverHelper } from './utils/WebDriverHelper';

afterAll(async () => {
  try {
    await WebDriverHelper.getInstance().quitDriver();
  } catch (e) {
    // ignore
  }
});

// This file is included in the Jest config's setupFilesAfterEnv
// No need to use Jest globals elsewhere as they're already available in test files
