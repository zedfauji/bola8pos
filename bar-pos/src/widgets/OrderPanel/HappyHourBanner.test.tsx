import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { ActivePromotionEntry } from '@entities/promotion';
import type { Promotion, PromotionAvailability } from '@shared/lib/domain';
import { HappyHourBanner } from './HappyHourBanner';

// Fix clock to 17:00 on a Monday (2024-01-01 is a Monday) — within any window
// whose day/time range straddles this time.
const FIXED_TIME = new Date('2024-01-01T17:00:00');
// A time outside of the 16:00–19:00 default window
const OUTSIDE_TIME = new Date('2024-01-01T20:00:00');

let promoIdCounter = 0;

function generateMockPromotion(overrides?: Partial<Promotion>): Promotion {
  promoIdCounter += 1;
  return {
    id: `00000000-0000-0000-0000-${String(promoIdCounter).padStart(12, '0')}`,
    name: 'Test Promotion',
    discountType: 'percentage',
    discountValue: 20,
    targetType: 'item',
    targetProductId: null,
    targetCategoryId: null,
    priority: 0,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00'),
    ...overrides,
  };
}

function generateMockWindow(
  promotionId: string,
  overrides?: Partial<PromotionAvailability>
): PromotionAvailability {
  return {
    id: '00000000-0000-0000-0000-000000000900',
    promotionId,
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    startTime: '16:00',
    endTime: '19:00',
    startDate: null,
    endDate: null,
    createdAt: new Date('2024-01-01T00:00:00'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HappyHourBanner (Active Promotions)', () => {
  it('renders null when no promotions have an active window', () => {
    vi.setSystemTime(OUTSIDE_TIME);
    const promotion = generateMockPromotion({ name: 'Beer Promo' });
    const entries: ActivePromotionEntry[] = [
      { promotion, windows: [generateMockWindow(promotion.id)] },
    ];
    const { container } = render(<HappyHourBanner activePromotions={entries} />);
    expect(container.querySelector('[data-testid="active-promotions-banner"]')).toBeNull();
  });

  it('renders banner when at least one promotion is in an active window', () => {
    vi.setSystemTime(FIXED_TIME);
    const promotion = generateMockPromotion({ name: 'Cocktails Promo' });
    const entries: ActivePromotionEntry[] = [
      { promotion, windows: [generateMockWindow(promotion.id)] },
    ];
    render(<HappyHourBanner activePromotions={entries} />);
    expect(screen.getByTestId('active-promotions-banner')).toBeInTheDocument();
    expect(screen.getByTestId('active-promotions-banner')).toHaveTextContent('Cocktails Promo');
    expect(screen.getByTestId('active-promotions-banner')).toHaveTextContent('Promotions Active');
  });

  it('shows multiple promotion names', () => {
    vi.setSystemTime(FIXED_TIME);
    const promo1 = generateMockPromotion({ name: 'Beer' });
    const promo2 = generateMockPromotion({ name: 'Wine' });
    const entries: ActivePromotionEntry[] = [
      { promotion: promo1, windows: [generateMockWindow(promo1.id)] },
      { promotion: promo2, windows: [generateMockWindow(promo2.id)] },
    ];
    render(<HappyHourBanner activePromotions={entries} />);
    const banner = screen.getByTestId('active-promotions-banner');
    expect(banner).toHaveTextContent('Beer');
    expect(banner).toHaveTextContent('Wine');
  });

  it('shows countdown to end time when the active window has a known end', () => {
    vi.setSystemTime(FIXED_TIME);
    const promotion = generateMockPromotion({ name: 'Spirits' });
    const entries: ActivePromotionEntry[] = [
      { promotion, windows: [generateMockWindow(promotion.id)] },
    ];
    render(<HappyHourBanner activePromotions={entries} />);
    const banner = screen.getByTestId('active-promotions-banner');
    // At 17:00, end is 19:00 — 2h remaining
    expect(banner).toHaveTextContent('Ends in');
  });

  it('omits the "Ends in…" suffix for an always-available promotion (no windows)', () => {
    vi.setSystemTime(FIXED_TIME);
    const promotion = generateMockPromotion({ name: 'Always On Combo Deal' });
    const entries: ActivePromotionEntry[] = [{ promotion, windows: [] }];
    render(<HappyHourBanner activePromotions={entries} />);
    const banner = screen.getByTestId('active-promotions-banner');
    expect(banner).toHaveTextContent('Promotions Active — Always On Combo Deal');
    expect(banner).not.toHaveTextContent('Ends in');
  });

  it('does not render for an inactive (isActive: false) promotion, even with no windows', () => {
    vi.setSystemTime(FIXED_TIME);
    const promotion = generateMockPromotion({ name: 'Disabled Promo', isActive: false });
    const entries: ActivePromotionEntry[] = [{ promotion, windows: [] }];
    const { container } = render(<HappyHourBanner activePromotions={entries} />);
    expect(container.querySelector('[data-testid="active-promotions-banner"]')).toBeNull();
  });
});
