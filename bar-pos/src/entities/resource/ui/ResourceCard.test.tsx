/**
 * ResourceCard keyboard/ARIA accessibility regression test (P0 finding from
 * /impeccable critique: occupied-table navigation was mouse/touch-only).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Resource } from '@shared/lib/domain';
import { ResourceCard } from './ResourceCard';

const baseTable: Resource = {
  id: 'table-1',
  number: 4,
  label: 'Table 4',
  ratePerHour: 100,
  status: 'occupied',
  tableType: 'pool',
  isTemp: false,
  currentSessionId: null,
};

describe('ResourceCard occupied-table navigation', () => {
  it('exposes a keyboard-focusable button role with a descriptive label', () => {
    render(<ResourceCard table={baseTable} session={null} onViewStatus={vi.fn()} firstHourMode="full" />);
    const card = screen.getByRole('button', { name: 'View status for Table 4' });
    expect(card).toHaveAttribute('tabIndex', '0');
  });

  it('calls onViewStatus on Enter and Space keydown', async () => {
    const onViewStatus = vi.fn();
    const user = userEvent.setup();
    render(<ResourceCard table={baseTable} session={null} onViewStatus={onViewStatus} firstHourMode="full" />);
    const card = screen.getByRole('button', { name: 'View status for Table 4' });

    card.focus();
    await user.keyboard('{Enter}');
    expect(onViewStatus).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(onViewStatus).toHaveBeenCalledTimes(2);
  });

  it('is not a button role and not clickable when the table is available (no onViewStatus target)', () => {
    render(
      <ResourceCard
        table={{ ...baseTable, status: 'available' }}
        session={null}
        onViewStatus={vi.fn()}
        firstHourMode="full"
      />
    );
    expect(screen.queryByRole('button', { name: /view status/i })).not.toBeInTheDocument();
  });
});
