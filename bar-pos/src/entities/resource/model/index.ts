/**
 * RESOURCE ENTITY - BARREL EXPORT
 */

// Types & Schemas
export {
  ResourceSchema,
  PoolSessionSchema,
  PoolSessionSummarySchema,
  ResourceTypeSchema,
} from './types';

export type {
  Resource,
  PoolSession,
  PoolTableStatus,
  ResourceType,
  PoolSessionSummary,
} from './types';

// State Management
export {
  useResourceStore,
  selectTableById,
  selectActiveSessionForTable,
  selectAvailableTableCount,
  selectSessionsByTabId,
} from './store';

// Data Fetching
export {
  resourceKeys,
  useResources,
  useResource,
  useMutationStartSession,
  useMutationStopSession,
  usePoolSessionsByTab,
  useMutationLinkPoolSessionToTab,
  useMutationReleaseResource,
  useMutationAddResource,
  useMutationUpdateResource,
  useMutationDeleteResource,
} from './queries';

export { usePoolTimer } from './usePoolTimer';
export type { UsePoolTimerOptions } from './usePoolTimer';
