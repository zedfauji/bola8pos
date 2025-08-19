import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { AuthProvider } from '../contexts/AuthContext';

// Mock the auth context
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock child components
const PublicPage = () => <div>Public Page</div>;
const ProtectedPage = () => <div>Protected Page</div>;
const LoginPage = () => <div>Login Page</div>;

// Helper function to render with router
const renderWithRouter = (ui, { route = '/', ...options } = {}) => {
  window.history.pushState({}, 'Test page', route);
  return render(ui, { wrapper: MemoryRouter, ...options });
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should render children when user is authenticated', async () => {
    // Set up a logged-in user
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', name: 'Test User' }));

    await act(async () => {
      renderWithRouter(
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <ProtectedPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>,
        { route: '/protected' }
      );
    });

    // Should render the protected page
    expect(screen.getByText('Protected Page')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should redirect to login when user is not authenticated', async () => {
    // No user in localStorage
    await act(async () => {
      renderWithRouter(
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <ProtectedPage />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AuthProvider>,
        { route: '/protected' }
      );
    });

    // Should redirect to login
    expect(mockNavigate).toHaveBeenCalledWith(
      '/login',
      {
        replace: true,
        state: { from: '/protected' }
      }
    );
  });

  it('should check for required permissions', async () => {
    // Set up a logged-in user with specific permissions
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem('user', JSON.stringify({
      id: '1',
      name: 'Test User',
      role: 'staff',
      permissions: {
        orders: ['view'],
        inventory: ['view']
      }
    }));

    await act(async () => {
      renderWithRouter(
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute requiredPermission="orders:view">
                  <ProtectedPage />
                </ProtectedRoute>
              }
            />
            <Route path="/unauthorized" element={<div>Unauthorized</div>} />
          </Routes>
        </AuthProvider>,
        { route: '/protected' }
      );
    });

    // Should render the protected page because user has the required permission
    expect(screen.getByText('Protected Page')).toBeInTheDocument();
    
    // Now test with a permission the user doesn't have
    await act(async () => {
      renderWithRouter(
        <AuthProvider>
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredPermission="admin:access">
                  <div>Admin Page</div>
                </ProtectedRoute>
              }
            />
            <Route path="/unauthorized" element={<div>Unauthorized</div>} />
          </Routes>
        </AuthProvider>,
        { route: '/admin' }
      );
    });

    // Should redirect to unauthorized page
    expect(mockNavigate).toHaveBeenCalledWith(
      '/unauthorized',
      {
        replace: true,
        state: { from: '/admin' }
      }
    );
  });

  it('should check for admin role', async () => {
    // Set up a non-admin user
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem('user', JSON.stringify({
      id: '1',
      name: 'Staff User',
      role: 'staff'
    }));

    await act(async () => {
      renderWithRouter(
        <AuthProvider>
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <div>Admin Dashboard</div>
                </ProtectedRoute>
              }
            />
            <Route path="/unauthorized" element={<div>Unauthorized</div>} />
          </Routes>
        </AuthProvider>,
        { route: '/admin' }
      );
    });

    // Should redirect to unauthorized page
    expect(mockNavigate).toHaveBeenCalledWith(
      '/unauthorized',
      {
        replace: true,
        state: { from: '/admin' }
      }
    );
  });
});
