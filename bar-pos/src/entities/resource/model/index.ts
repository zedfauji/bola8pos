/**
 * RESOURCE ENTITY - BARREL EXPORT
 */

// Types & Schemas
export { ResourceSchema, PoolSessionSchema } from './types';

// State Management
export { useResourceStore } from './store';

// Data Fetching
export { resourceKeys, useResources, useResource, useMutationStartSession, useMutationStopSession, useMutationLinkPoolSessionToTab, useMutationReleaseResource, useMutationAddResource, useMutationUpdateResource, useMutationDeleteResource } from './queries';

export { usePoolTimer } from './usePoolTimer';
export type { UsePoolTimerOptions } from './usePoolTimer';
