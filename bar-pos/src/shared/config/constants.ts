// Pool Table Configuration
export const MAX_POOL_TABLES = 30;
export const BILLING_ROUND_MINUTES = 15;
export const DEFAULT_POOL_RATE_PER_HOUR = 10;

// Terminal Configuration
export const MAX_TERMINALS = 2;
export const TERMINAL_ID = 'POS-1';

// Application
export const APP_NAME = 'Bar & Pool Parlor POS';

// Route paths
export const ROUTES = {
  pos: '/',
  poolTables: '/pool-tables',
  staff: '/staff',
  reports: '/reports',
  inventory: '/inventory',
  settings: '/settings',
  rappi: '/rappi',
  login: '/login',
} as const;
