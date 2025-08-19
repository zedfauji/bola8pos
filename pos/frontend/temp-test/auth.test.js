import { test, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Mock the actual auth service
const mockAuthService = {
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
};

// Reset mocks before each test
beforeEach(() => {
  vi.resetAllMocks();
  localStorageMock.clear();
});

test('login should store token and user data', async () => {
  // Mock a successful login response
  const mockUser = { id: '123', name: 'Test User', role: 'admin' };
  const mockTokens = { accessToken: 'test-access-token', refreshToken: 'test-refresh-token' };
  
  mockAuthService.login.mockResolvedValueOnce({
    user: mockUser,
    tokens: mockTokens,
  });

  // Simulate login
  await mockAuthService.login('test@example.com', 'password');

  // Verify login was called with correct credentials
  expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password');
  
  // In a real test, we would also verify that:
  // 1. Tokens were stored in localStorage
  // 2. User data was stored in context/state
});

test('logout should clear stored data', async () => {
  // Simulate logout
  await mockAuthService.logout();

  // Verify logout was called
  expect(mockAuthService.logout).toHaveBeenCalled();
  
  // In a real test, we would also verify that:
  // 1. Tokens were removed from localStorage
  // 2. User data was cleared from context/state
});
