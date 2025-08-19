import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import withRoleGuard from '../components/auth/withRoleGuard';

// Mock components
const TestComponent = () => <div data-testid="test-component">Protected Content</div>;
const UnauthorizedPage = () => <div data-testid="unauthorized-page">Unauthorized</div>;
const LoginPage = () => <div data-testid="login-page">Login</div>;

// Mock AuthContext
jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    isAuthenticated: jest.fn().mockReturnValue(true),
    user: { role: 'staff' },
    loading: false
  })
}));

describe('withRoleGuard HOC', () => {
  const ProtectedComponent = withRoleGuard(TestComponent, {
    requiredRoles: ['manager', 'admin'],
    redirectTo: '/unauthorized'
  });

  const renderWithRouter = (ui, { route = '/' } = {}) => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the protected component when user has required role', () => {
    // Override the mock to return a user with manager role
    require('../contexts/AuthContext').useAuth.mockReturnValue({
      isAuthenticated: jest.fn().mockReturnValue(true),
      user: { role: 'manager' },
      loading: false
    });

    renderWithRouter(<ProtectedComponent />);
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  it('should redirect to unauthorized page when user does not have required role', () => {
    // Use the default mock which returns a user with staff role
    renderWithRouter(<ProtectedComponent />);
    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
  });

  it('should redirect to login page when user is not authenticated', () => {
    // Override the mock to return unauthenticated state
    require('../contexts/AuthContext').useAuth.mockReturnValue({
      isAuthenticated: jest.fn().mockReturnValue(false),
      user: null,
      loading: false
    });

    renderWithRouter(<ProtectedComponent />);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('should show loading state when authentication is being checked', () => {
    // Override the mock to return loading state
    require('../contexts/AuthContext').useAuth.mockReturnValue({
      isAuthenticated: jest.fn().mockReturnValue(false),
      user: null,
      loading: true
    });

    renderWithRouter(<ProtectedComponent />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should allow access when using minRole and user has sufficient privileges', () => {
    // Create a component with minRole option
    const MinRoleComponent = withRoleGuard(TestComponent, {
      minRole: 'staff',
      redirectTo: '/unauthorized'
    });

    // User with staff role should have access
    renderWithRouter(<MinRoleComponent />);
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  it('should deny access when using strict mode and user has higher role', () => {
    // Override the mock to return a user with admin role
    require('../contexts/AuthContext').useAuth.mockReturnValue({
      isAuthenticated: jest.fn().mockReturnValue(true),
      user: { role: 'admin' },
      loading: false
    });

    // Create a component with strict mode
    const StrictComponent = withRoleGuard(TestComponent, {
      requiredRoles: ['manager'],
      strict: true,
      redirectTo: '/unauthorized'
    });

    renderWithRouter(<StrictComponent />);
    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
  });
});
