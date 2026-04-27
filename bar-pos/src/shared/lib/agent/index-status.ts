import { invoke } from '@tauri-apps/api/core';
import { logger } from '@shared/lib/logger';

/**
 * Returns the number of indexed codebase chunks in pos_codebase_index.
 * Calls the Rust `agent_index_status` Tauri command via IPC.
 * Returns 0 on error so callers can degrade gracefully.
 */
export async function getAgentIndexStatus(): Promise<number> {
  try {
    return await invoke<number>('agent_index_status');
  } catch (e) {
    logger.warn('agent.index_status.failed', { detail: String(e) });
    return 0;
  }
}
