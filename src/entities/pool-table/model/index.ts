/**
 * POOL TABLE ENTITY - BARREL EXPORT
 */

// Types & Schemas
export { PoolTableSchema, PoolSessionSchema, PoolSessionSummarySchema } from './types';

export type { PoolTable, PoolSession, PoolTableStatus, PoolSessionSummary } from './types';

// State Management
export {
  usePoolTableStore,
  selectTableById,
  selectActiveSessionForTable,
  selectAvailableTableCount,
  selectSessionsByTabId,
} from './store';

// Data Fetching
export {
  poolTableKeys,
  usePoolTables,
  usePoolTable,
  useMutationStartSession,
  useMutationStopSession,
  usePoolSessionsByTab,
  useMutationLinkPoolSessionToTab,
  useMutationReleasePoolTable,
  useMutationAddPoolTable,
  useMutationUpdatePoolTable,
  useMutationDeletePoolTable,
} from './queries';

export { usePoolTimer } from './usePoolTimer';
export type { UsePoolTimerOptions } from './usePoolTimer';
