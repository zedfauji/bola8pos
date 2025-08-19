import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import type { RenderOptions } from '@testing-library/react';

// Mock providers to avoid loading actual contexts in tests
const MockSettingsProvider = ({ children }: { children: ReactNode; settings?: any }) => (
  <div data-testid="mock-settings-provider">{children}</div>
);

const MockAuthProvider = ({ children }: { children: ReactNode }) => (
  <div data-testid="mock-auth-provider">{children}</div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

interface AllProvidersProps {
  children: ReactNode;
  initialEntries?: string[];
  settings?: any;
}

const AllProviders = ({ children, initialEntries = ['/'], settings = {} }: AllProvidersProps) => (
  <MemoryRouter initialEntries={initialEntries}>
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <MockSettingsProvider settings={settings}>
          {children}
        </MockSettingsProvider>
      </MockAuthProvider>
    </QueryClientProvider>
  </MemoryRouter>
);

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  settings?: any;
}

const customRender = (
  ui: ReactElement,
  { initialEntries, settings, ...options }: CustomRenderOptions = {}
) => ({
  ...render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialEntries={initialEntries} settings={settings}>
        {children}
      </AllProviders>
    ),
    ...options,
  }),
  queryClient,
});

// Mock API client for testing
export const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  verifyManagerPin: jest.fn(),
};

// Extend Jest types
declare global {
  namespace jest {
    interface Mock<T = any, Y extends any[] = any> {
      new (...args: Y): T;
      (...args: Y): T;
      _isMockFunction: boolean;
      getMockName(): string;
      mock: {
        calls: Y[];
        instances: T[];
        results: Array<{ type: 'return' | 'throw'; value: any }>;
      };
      mockClear(): void;
      mockReset(): void;
      mockRestore(): void;
      mockImplementation(fn: (...args: Y) => any): this;
      mockImplementationOnce(fn: (...args: Y) => any): this;
      mockName(name: string): this;
      mockReturnThis(): this;
      mockReturnValue(value: any): this;
      mockReturnValueOnce(value: any): this;
      mockResolvedValue(value: any): this;
      mockResolvedValueOnce(value: any): this;
      mockRejectedValue(value: any): this;
      mockRejectedValueOnce(value: any): this;
    }
  }
}

// Default settings for tests
export const defaultSettings = {
  auth: {
    loginMode: 'pin' as const,
    sessionTimeoutMinutes: 30,
  },
  access: {
    requirePinLifecycle: true,
    requirePinVoidComp: true,
    requirePinRefund: true,
    approvalThresholds: { discountPct: 20, refundAmount: 50, cashPayoutAmount: 50 },
  },
  store: {
    name: 'Test POS',
    locale: 'en-US',
    currencyCode: 'USD',
    currencySymbol: '$',
  },
};

// Export testing library utilities and our custom render function
export * from '@testing-library/react';
export { customRender as render };
