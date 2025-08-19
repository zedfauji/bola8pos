// Export all type declarations
export * from './auth';
export * from './axios';
export * from './socket';
export * from './indexedDb';

// Global type extensions
declare global {
  // Add any global type extensions here
  interface Window {
    // Add any window extensions here
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: any;
    /** Custom global set in `src/main.tsx` to propagate API base URL */
    __API_BASE_URL__?: string;
  }
}

// This file serves as a central export point for all type declarations
// Import this file in your components to get access to all types
