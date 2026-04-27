/**
 * Unit tests for EditStartTimeDialog.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoolSession } from '@shared/lib/domain';
import { err, ok } from '@shared/lib/result';
import { renderWithProviders } from '@shared/lib/test-utils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEditStartTime = vi.fn();

vi.mock('../model/useEditSessionStartTime', () => ({
  useEditSessionStartTime: () => ({
    editStartTime: mockEditStartTime,
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Import after mocks

import { EditStartTimeDialog } from './EditStartTimeDialog';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sessionStartedAt = new Date('2026-04-21T09:30:00');

const testSession: PoolSession = {
  id: 'session-uuid-001',
  tableId: 'table-uuid-001',
  tabId: 'tab-uuid-001',
  startedAt: sessionStartedAt,
  stoppedAt: null,
  billedMinutes: null,
  totalCharge: null,
};

// Helper to build the datetime-local string matching component logic
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(open = true) {
  const onOpenChange = vi.fn();
  renderWithProviders(
    <EditStartTimeDialog open={open} onOpenChange={onOpenChange} session={testSession} />
  );
  return { onOpenChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditStartTimeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders current start time as read-only text', () => {
    renderDialog();
    const formatted = testSession.startedAt.toLocaleString([], {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    expect(
      screen.getByText(new RegExp(formatted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    ).toBeInTheDocument();
  });

  it('input is pre-filled with session.startedAt in datetime-local format', () => {
    renderDialog();
    const input = screen.getByLabelText<HTMLInputElement>(/new start time/i);
    expect(input.value).toBe(toDatetimeLocal(testSession.startedAt));
  });

  it('submitting with a future datetime shows inline error, mutation NOT called', async () => {
    mockEditStartTime.mockResolvedValue(
      err({
        code: 'VALIDATION_ERROR' as const,
        message: 'Please check the highlighted fields.',
        detail: JSON.stringify({ startedAt: 'Start time must be in the past' }),
      })
    );

    renderDialog();

    const input = screen.getByLabelText(/new start time/i);
    fireEvent.change(input, { target: { value: '2099-01-01T10:00' } });

    const form = screen.getByTestId('edit-start-time-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/start time must be in the past/i)).toBeInTheDocument();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('submitting with valid past time: mutation called, success toast shown, dialog closes', async () => {
    mockEditStartTime.mockResolvedValue(ok(undefined));
    const { onOpenChange } = renderDialog();

    const input = screen.getByLabelText(/new start time/i);
    fireEvent.change(input, { target: { value: '2026-04-21T08:00' } });

    const form = screen.getByTestId('edit-start-time-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockEditStartTime).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Session start time updated.');
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('dialog close callback resets errors', async () => {
    mockEditStartTime.mockResolvedValue(
      err({
        code: 'VALIDATION_ERROR' as const,
        message: 'Please check the highlighted fields.',
        detail: JSON.stringify({ startedAt: 'Start time must be in the past' }),
      })
    );

    const { onOpenChange } = renderDialog();

    const form = screen.getByTestId('edit-start-time-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/start time must be in the past/i)).toBeInTheDocument();
    });

    // Click Cancel to close
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
