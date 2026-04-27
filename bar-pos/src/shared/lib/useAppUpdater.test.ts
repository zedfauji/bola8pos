/**
 * Unit tests for useAppUpdater hook.
 *
 * UPD-01: check() called on mount
 * UPD-02: check() called again after 4-hour interval
 * UPD-05: dismiss returns to idle
 * UPD-07: silent failure on network error / no update
 * UPD-08: progress state updates during download
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Import the module references AFTER vi.mock — test-setup.ts has global mocks
import { check } from '@tauri-apps/plugin-updater';
import { useAppUpdater } from '@shared/lib/useAppUpdater';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

describe('useAppUpdater', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(check).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stays idle when check() returns null (UPD-07)', async () => { /* STUB */ });
  it('stays idle when check() throws (UPD-07)', async () => { /* STUB */ });
  it('calls check() on mount (UPD-01)', async () => { /* STUB */ });
  it('calls check() again after 4 hours (UPD-02)', async () => { /* STUB */ });
  it('transitions to available when update found (UPD-01)', async () => { /* STUB */ });
  it('dismissUpdate resets to idle (UPD-05)', async () => { /* STUB */ });
  it('startInstall transitions downloading → restart-ready (UPD-08)', async () => { /* STUB */ });
});
