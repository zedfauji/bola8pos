import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { generateMockCategory } from '@shared/lib/mocks';
import { HappyHourBanner } from './HappyHourBanner';

// Fix clock to 17:00 — within any category whose HH window straddles this time.
const FIXED_TIME = new Date('2024-01-01T17:00:00');
// A time outside of the 16:00–19:00 default window from generateMockCategory
const OUTSIDE_TIME = new Date('2024-01-01T20:00:00');

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HappyHourBanner', () => {
  it('renders null when no categories have active HH', () => {
    vi.setSystemTime(OUTSIDE_TIME);
    // generateMockCategory defaults to 16:00–19:00; 20:00 is outside that window
    const categories = [generateMockCategory({ happyHourStart: '16:00', happyHourEnd: '19:00' })];
    const { container } = render(<HappyHourBanner categories={categories} now={OUTSIDE_TIME} />);
    expect(container.querySelector('[data-testid="happy-hour-banner"]')).toBeNull();
  });

  it('renders banner when at least one category is in HH window', () => {
    vi.setSystemTime(FIXED_TIME);
    const category = generateMockCategory({
      name: 'Cocktails',
      happyHourStart: '16:00',
      happyHourEnd: '19:00',
    });
    render(<HappyHourBanner categories={[category]} now={FIXED_TIME} />);
    expect(screen.getByTestId('happy-hour-banner')).toBeInTheDocument();
    expect(screen.getByTestId('happy-hour-banner')).toHaveTextContent('Cocktails');
  });

  it('shows multiple category names', () => {
    vi.setSystemTime(FIXED_TIME);
    const cat1 = generateMockCategory({
      name: 'Beer',
      happyHourStart: '16:00',
      happyHourEnd: '19:00',
    });
    const cat2 = generateMockCategory({
      name: 'Wine',
      happyHourStart: '16:00',
      happyHourEnd: '19:00',
    });
    render(<HappyHourBanner categories={[cat1, cat2]} now={FIXED_TIME} />);
    const banner = screen.getByTestId('happy-hour-banner');
    expect(banner).toHaveTextContent('Beer');
    expect(banner).toHaveTextContent('Wine');
  });

  it('shows countdown to end time', () => {
    vi.setSystemTime(FIXED_TIME);
    const category = generateMockCategory({
      name: 'Spirits',
      happyHourStart: '16:00',
      happyHourEnd: '19:00',
    });
    render(<HappyHourBanner categories={[category]} now={FIXED_TIME} />);
    const banner = screen.getByTestId('happy-hour-banner');
    // At 17:00, end is 19:00 — 2h remaining
    expect(banner).toHaveTextContent('Ends in');
  });
});
