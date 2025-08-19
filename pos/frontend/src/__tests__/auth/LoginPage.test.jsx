import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import LoginPage from '../pages/LoginPage';

// Mock the authService
jest.mock('../services/authService', () => ({
  login: jest.fn(),
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    state: { from: { pathname: '/dashboard' } },
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const renderLoginPage = () => {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('should render login form', () => {
    renderLoginPage();
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should validate form inputs', async () => {
    renderLoginPage();
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    // Test empty submission
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    
    // Test invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    
    // Test short password
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/password must be at least 6 characters/i)).toBeInTheDocument();
  });

  it('should handle successful login', async () => {
    const { login } = require('../services/authService');
    const mockUser = { id: '1', name: 'Test User', role: 'admin' };
    const mockToken = 'test-token';
    const mockRefreshToken = 'refresh-token';
    
    login.mockResolvedValueOnce({
      user: mockUser,
      accessToken: mockToken,
      refreshToken: mockRefreshToken,
    });

    renderLoginPage();
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    // Check if login was called with correct credentials
    expect(login).toHaveBeenCalledWith('test@example.com', 'password123');
    
    // Check if navigation occurred
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
    
    // Check if user data is stored
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(mockUser);
    expect(localStorage.getItem('accessToken')).toBe(mockToken);
    expect(localStorage.getItem('refreshToken')).toBe(mockRefreshToken);
  });

  it('should display error on login failure', async () => {
    const { login } = require('../services/authService');
    const errorMessage = 'Invalid credentials';
    login.mockRejectedValueOnce(new Error(errorMessage));
    
    renderLoginPage();
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });
    
    // Check if error message is displayed
    expect(await screen.findByText(errorMessage)).toBeInTheDocument();
    
    // Check that navigation did not occur
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
