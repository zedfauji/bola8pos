/**
 * TAB CARD TESTS
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatTimeOpen } from '@shared/lib/domain-helpers';
import { mockTab } from '../model/types';
import { TabCard } from './TabCard';

describe('TabCard', () => {
  const baseProps = { isActive: false, onSelect: vi.fn() };

  /** Tab open ~30m at frozen "now" for stable assertions */
  const tabShort = { ...mockTab, openedAt: new Date('2026-04-16T21:30:00Z') };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders tab customer name', () => {
    vi.setSystemTime(new Date('2026-04-16T22:00:00Z'));
    render(<TabCard {...baseProps} tab={tabShort} />);
    expect(screen.getByText(mockTab.customerName)).toBeInTheDocument();
  });

  it('renders table number when present', () => {
    vi.setSystemTime(new Date('2026-04-16T22:00:00Z'));
    render(<TabCard {...baseProps} tab={tabShort} />);
    expect(screen.getByText(`Table ${String(mockTab.tableNumber)}`)).toBeInTheDocument();
  });

  it('does not render table number when null', () => {
    vi.setSystemTime(new Date('2026-04-16T22:00:00Z'));
    const tabWithoutTable = { ...tabShort, tableNumber: null };
    render(<TabCard {...baseProps} tab={tabWithoutTable} />);
    expect(screen.queryByText(/Table/)).not.toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    vi.setSystemTime(new Date('2026-04-16T22:00:00Z'));
    const onSelect = vi.fn();
    render(<TabCard {...baseProps} tab={tabShort} onSelect={onSelect} />);

    const card = screen.getByRole('button');
    fireEvent.click(card);

    expect(onSelect).toHaveBeenCalledWith(mockTab.id);
  });

  it('displays item count', () => {
    vi.setSystemTime(new Date('2026-04-16T22:00:00Z'));
    render(<TabCard {...baseProps} tab={tabShort} />);
    expect(screen.getByText(/1 item/)).toBeInTheDocument();
  });

  it('displays correct plural for multiple items', () => {
    vi.setSystemTime(new Date('2026-04-16T22:00:00Z'));
    const firstItem = mockTab.items[0];
    if (!firstItem) return;

    const tabWithMultipleItems = {
      ...tabShort,
      items: [firstItem, { ...firstItem, id: 'item-2', orderId: firstItem.orderId }],
    };
    render(<TabCard {...baseProps} tab={tabWithMultipleItems} />);
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
  });

  it('renders time open using formatTimeOpen', () => {
    const now = new Date('2026-04-16T22:00:00Z');
    vi.setSystemTime(now);
    const openedAt = new Date('2026-04-16T20:00:00Z');
    const tab = { ...mockTab, openedAt };
    render(<TabCard {...baseProps} tab={tab} />);
    expect(screen.getByText(formatTimeOpen(openedAt, now))).toBeInTheDocument();
  });

  it('shows yellow tier badge at 2 hours open', () => {
    const now = new Date('2026-04-16T22:00:00Z');
    vi.setSystemTime(now);
    const openedAt = new Date('2026-04-16T19:59:00Z');
    const tab = { ...mockTab, openedAt };
    render(<TabCard {...baseProps} tab={tab} />);
    expect(screen.getByLabelText('Status: 2h+')).toBeInTheDocument();
  });

  it('shows red tier badge at 4 hours open', () => {
    const now = new Date('2026-04-16T22:00:00Z');
    vi.setSystemTime(now);
    const openedAt = new Date('2026-04-16T17:59:00Z');
    const tab = { ...mockTab, openedAt };
    render(<TabCard {...baseProps} tab={tab} />);
    expect(screen.getByLabelText('Status: 4h+')).toBeInTheDocument();
  });
});
