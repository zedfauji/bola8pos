/**
 * MONEY DISPLAY TESTS
 *
 * End-to-end proof for Phase 28's tracer slice: staff locale in the i18n
 * singleton, through @shared/lib/format, out to rendered DOM.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@shared/lib/i18n/index';
import { MoneyDisplay } from './MoneyDisplay';

describe('MoneyDisplay', () => {
  afterEach(async () => {
    await i18n.changeLanguage('es-MX'); // reset for other tests/consumers
  });

  it('renders the es-MX symbol under the default locale', () => {
    render(<MoneyDisplay amount={12.5} />);
    expect(screen.getByText('MX$12.50')).toBeInTheDocument();
  });

  it('renders the en-US symbol after switching the i18n language', async () => {
    await i18n.changeLanguage('en-US');
    render(<MoneyDisplay amount={12.5} />);
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });

  it('renders exactly one minus-family glyph and no doubled currency symbol for a negative amount', () => {
    render(<MoneyDisplay amount={-5} />);
    const text = screen.getByText(/MX\$5\.00/).textContent ?? '';
    expect(text).toBe('−MX$5.00');
    // exactly one minus-family glyph (the component's own U+2212 prefix)
    expect(text.match(/[-−]/g)).toHaveLength(1);
    // no doubled currency symbol
    expect(text.match(/MX\$/g)).toHaveLength(1);
  });
});
