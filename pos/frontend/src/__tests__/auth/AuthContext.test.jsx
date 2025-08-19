import { render, screen, act } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Mock the authService
jest.mock('../services/authService', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  getCurrentUser: jest.fn(),
}));

// Test component that uses the auth context
const TestComponent = () => {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <div data-testid="user">{JSON.stringify(user)}</div>
      <div data-testid="isAuthenticated">{isAuthenticated() ? 'true' : 'false'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear all mocks and localStorage before each test
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should provide initial auth state', async () => {
    render(
      <Router>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </Router>
    );

    // Initially, user should be null and not authenticated
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
  });

  it('should set user on successful login', async () => {
    const mockUser = { id: '1', name: 'Test User', role: 'admin' };
    const mockToken = 'test-token';
    const mockRefreshToken = 'refresh-token';
    
    // Mock the login function
    const { login } = require('../services/authService');
    login.mockResolvedValueOnce({
      user: mockUser,
      accessToken: mockToken,
      refreshToken: mockRefreshToken,
    });

    // Create a test component that will trigger login
    const LoginTest = () => {
      const { login: authLogin } = useAuth();
      
      useEffect(() => {
        const doLogin = async () => {
          await authLogin('test@example.com', 'password');
        };
        doLogin();
      }, [authLogin]);
      
      return <TestComponent />;
    };

    await act(async () => {
      render(
        <Router>
          <AuthProvider>
            <LoginTest />
          </AuthProvider>
        </Router>
      );
    });

    // After login, user should be set and authenticated
    expect(JSON.parse(screen.getByTestId('user').textContent)).toEqual(mockUser);
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
    
    // Tokens should be stored in localStorage
    expect(localStorage.getItem('accessToken')).toBe(mockToken);
    expect(localStorage.getItem('refreshToken')).toBe(mockRefreshToken);
  });

  it('should clear user on logout', async () => {
    // Set initial state with a logged-in user
    const mockUser = { id: '1', name: 'Test User', role: 'admin' };
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem('refreshToken', 'refresh-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    // Mock the logout function
    const { logout } = require('../services/authService');
    logout.mockResolvedValueOnce({});

    // Create a test component that will trigger logout
    const LogoutTest = () => {
      const { logout: authLogout } = useAuth();
      
      useEffect(() => {
        const doLogout = async () => {
          await authLogout();
        };
        doLogout();
      }, [authLogout]);
      
      return <TestComponent />;
    };

    await act(async () => {
      render(
        <Router>
          <AuthProvider>
            <LogoutTest />
          </AuthProvider>
        </Router>
      );
    });

    // After logout, user should be null and not authenticated
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
    
    // Tokens should be removed from localStorage
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
