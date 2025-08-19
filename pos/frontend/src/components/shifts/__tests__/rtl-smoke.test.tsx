import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function Hello() {
  return <div>RTL OK</div>;
}

describe('RTL environment smoke', () => {
  it('renders without css.escape issues', () => {
    render(<Hello />);
    expect(screen.getByText('RTL OK')).toBeInTheDocument();
  });
});
