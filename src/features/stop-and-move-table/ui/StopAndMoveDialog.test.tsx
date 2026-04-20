import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PoolSession, PoolTable } from '@shared/lib/domain';

import { StopAndMoveDialog } from './StopAndMoveDialog';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockMutateAsync = vi.fn();
vi.mock('../useStopAndMoveSession', () => ({
  useStopAndMoveSession: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseSession: PoolSession = {
  id: 'ssssssss-ssss-4sss-8sss-ssssssssssss',
  tabId: 'tttttttt-tttt-4ttt-8ttt-tttttttttttt',
  tableId: 'pppppppp-pppp-4ppp-8ppp-pppppppppppp',
  startedAt: new Date('2026-04-20T10:00:00Z'),
  stoppedAt: null,
  billedMinutes: null,
  totalCharge: null,
  previousTableId: null,
  previousTableNumber: null,
};

const baseTable: PoolTable = {
  id: 'pppppppp-pppp-4ppp-8ppp-pppppppppppp',
  number: 3,
  label: 'Billar 3',
  status: 'occupied',
  ratePerHour: 60,
  currentSessionId: baseSession.id,
  currentSession: undefined,
};

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function renderDialog(props: Partial<Parameters<typeof StopAndMoveDialog>[0]> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  const defaultProps = {
    open: true,
    session: baseSession,
    table: baseTable,
    tabId: 'tttttttt-tttt-4ttt-8ttt-tttttttttttt',
    onClose,
    onSuccess,
    ...props,
  };

  render(createElement(StopAndMoveDialog, defaultProps), {
    wrapper: makeWrapper(queryClient),
  });

  return { onClose, onSuccess, queryClient };
}

// Helper to set the table number input value
function setTableInput(value: string) {
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StopAndMoveDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the table label in the dialog description', () => {
    renderDialog();
    expect(screen.getByText(/Billar 3/i)).toBeInTheDocument();
  });

  it('confirm button is disabled when input is empty', () => {
    renderDialog();
    const btn = screen.getByRole('button', { name: /stop & move/i });
    expect(btn).toBeDisabled();
  });

  it('confirm button is disabled when input is "0" (below minimum)', () => {
    renderDialog();
    setTableInput('0');
    const btn = screen.getByRole('button', { name: /stop & move/i });
    expect(btn).toBeDisabled();
  });

  it('confirm button is disabled when input is "201" (above maximum)', () => {
    renderDialog();
    setTableInput('201');
    const btn = screen.getByRole('button', { name: /stop & move/i });
    expect(btn).toBeDisabled();
  });

  it('confirm button is enabled when input is "1" (minimum valid)', () => {
    renderDialog();
    setTableInput('1');
    const btn = screen.getByRole('button', { name: /stop & move/i });
    expect(btn).not.toBeDisabled();
  });

  it('confirm button is enabled when input is "100"', () => {
    renderDialog();
    setTableInput('100');
    const btn = screen.getByRole('button', { name: /stop & move/i });
    expect(btn).not.toBeDisabled();
  });

  it('confirm button is enabled when input is "200" (maximum valid)', () => {
    renderDialog();
    setTableInput('200');
    const btn = screen.getByRole('button', { name: /stop & move/i });
    expect(btn).not.toBeDisabled();
  });

  it('calls mutation with correct tableId and newTableNumber on confirm', async () => {
    mockMutateAsync.mockResolvedValue({ ok: true, data: undefined });
    renderDialog();

    setTableInput('7');
    fireEvent.click(screen.getByRole('button', { name: /stop & move/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          tableId: baseTable.id,
          newTableNumber: 7,
          sessionId: baseSession.id,
          tabId: 'tttttttt-tttt-4ttt-8ttt-tttttttttttt',
          ratePerHour: baseTable.ratePerHour,
        })
      );
    });
  });

  it('calls onSuccess and onClose on successful mutation', async () => {
    mockMutateAsync.mockResolvedValue({ ok: true, data: undefined });
    const { onClose, onSuccess } = renderDialog();

    setTableInput('5');
    fireEvent.click(screen.getByRole('button', { name: /stop & move/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast and does NOT call onSuccess on mutation failure', async () => {
    mockMutateAsync.mockResolvedValue({
      ok: false,
      error: { code: 'SUPABASE_ERROR', message: 'Session update failed' },
    });
    const { onSuccess } = renderDialog();

    setTableInput('5');
    fireEvent.click(screen.getByRole('button', { name: /stop & move/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Session update failed');
    });
    // onSuccess must never be called on error — that is the critical invariant
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
