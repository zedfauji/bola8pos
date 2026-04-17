import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginUiStore } from '@entities/staff/model/loginUiStore';
import * as staffQueries from '@entities/staff/model/queries';
import { useStaffStore } from '@entities/staff/model/store';
import { mockStaff } from '@entities/staff/model/types';
import type { Shift } from '@shared/lib/domain';
import { ok, err } from '@shared/lib/result';
import { PINLoginForm } from './PINLoginForm';

vi.mock('@entities/staff/model/queries', async importOriginal => {
  const actual = await importOriginal();
  return Object.assign({}, actual, { useMutationClockIn: vi.fn() });
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const shiftOk: Shift = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  staffId: mockStaff[0]!.id,
  clockIn: new Date(),
  clockOut: null,
  openingCash: 50,
  closingCash: null,
};

function renderLoginForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PINLoginForm />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PINLoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStaffStore.getState().logout();
    useLoginUiStore.getState().clearSelection();
    useLoginUiStore.getState().setSelectedStaff(mockStaff[0]!);
  });

  it('after successful PIN and opening cash, logs into staffStore and clears login UI selection', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(ok(shiftOk));
    vi.mocked(staffQueries.useMutationClockIn).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof staffQueries.useMutationClockIn>);

    const user = userEvent.setup();
    renderLoginForm();

    for (const d of ['1', '2', '3', '4', '5', '6'] as const) {
      await user.click(screen.getByRole('button', { name: `Key ${d}` }));
    }

    await waitFor(() => {
      expect(
        screen.getByText(
          'Enter the cash drawer float for this shift. You can use zero if nothing is counted yet.'
        )
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Start shift' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        staffId: mockStaff[0]!.id,
        openingCash: 0,
      });
    });

    await waitFor(() => {
      const { currentStaff, currentShift, isAuthenticated } = useStaffStore.getState();
      expect(isAuthenticated).toBe(true);
      expect(currentStaff?.id).toBe(mockStaff[0]!.id);
      expect(currentShift?.id).toBe(shiftOk.id);
      expect(currentShift?.staffId).toBe(mockStaff[0]!.id);
      expect(useLoginUiStore.getState().selectedStaff).toBeNull();
    });
  });

  it('does not log in when clock-in fails', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(err({ code: 'TEST', message: 'Network down' }));
    vi.mocked(staffQueries.useMutationClockIn).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof staffQueries.useMutationClockIn>);

    const user = userEvent.setup();
    renderLoginForm();

    for (const d of ['1', '2', '3', '4', '5', '6'] as const) {
      await user.click(screen.getByRole('button', { name: `Key ${d}` }));
    }

    await waitFor(() => {
      expect(
        screen.getByText(
          'Enter the cash drawer float for this shift. You can use zero if nothing is counted yet.'
        )
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Start shift' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
    });

    expect(useStaffStore.getState().isAuthenticated).toBe(false);
    expect(useStaffStore.getState().currentShift).toBeNull();
  });
});
