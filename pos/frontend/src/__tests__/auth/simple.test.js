import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../../contexts/AuthContext';

// Simple test to verify the test environment works
test('AuthProvider renders children', () => {
  render(
    <AuthProvider>
      <div data-testid="test-child">Test Child</div>
    </AuthProvider>
  );
  
  expect(screen.getByTestId('test-child')).toHaveTextContent('Test Child');
});
