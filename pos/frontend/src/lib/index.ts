// Re-export all utilities
export * from './utils';

// Re-export other utilities
export * from './auth';
export * from './axios';
export * from './socket';

export * as indexedDB from './indexedDb';

// Add type exports
export type { User, AuthResponse } from './auth';
export type { ApiResponse, ApiError } from './axios';

// Export types for external use
export * from '../types';

// Global type declarations
declare global {
  // This helps with module resolution for the @/lib path
  const __webpack_public_path__: string;
}

// This helps TypeScript understand our module exports
export {};
