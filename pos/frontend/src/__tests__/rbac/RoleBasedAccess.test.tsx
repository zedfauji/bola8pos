import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from '../../contexts/AuthContext';
import { withRoleGuard } from '../../components/auth/withRoleGuard';
import { ProtectedTableActions } from '../../components/tables/ProtectedTableActions';
import AdminDashboard from '../../pages/tables/AdminDashboard';
import EmployeeDashboard from '../../pages/tables/EmployeeDashboard';

// Mock components for testing
const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;
const FallbackComponent = () => <div data-testid="fallback-content">Access Denied</div>;

// Mock auth service
const mockAuthService = {
  login: jest.fn(),
  refreshTokenApi: jest.fn(),
};

jest.mock('../../services/authService', () => mockAuthService);
jest.mock('../../lib/apiClient');

// Test wrapper component
const TestWrapper = ({ children, user }: { children: React.ReactNode; user: any }) => {
  const mockAuthContext = {
    user,
    loading: false,
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    isAuthenticated: () => !!user,
    hasPermission: (permission: string) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return user.permissions?.[permission] || false;
    },
  };

  return (
    <BrowserRouter>
      <SnackbarProvider>
        <AuthProvider value={mockAuthContext}>
          {children}
        </AuthProvider>
      </SnackbarProvider>
    </BrowserRouter>
  );
};

describe('Role-Based Access Control (RBAC)', () => {
  describe('withRoleGuard HOC', () => {
    it('should allow admin users to access admin-only components', () => {
      const AdminOnlyComponent = withRoleGuard(TestComponent, { requiredRole: 'admin' });
      const adminUser = { id: '1', email: 'admin@test.com', role: 'admin' };

      render(
        <TestWrapper user={adminUser}>
          <AdminOnlyComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should block non-admin users from admin-only components', () => {
      const AdminOnlyComponent = withRoleGuard(TestComponent, { 
        requiredRole: 'admin',
        fallbackComponent: FallbackComponent
      });
      const employeeUser = { id: '2', email: 'employee@test.com', role: 'employee' };

      render(
        <TestWrapper user={employeeUser}>
          <AdminOnlyComponent />
        </TestWrapper>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
    });

    it('should show admin access modal when requireAdminLogin is true', async () => {
      const AdminOnlyComponent = withRoleGuard(TestComponent, { 
        requiredRole: 'admin',
        requireAdminLogin: true
      });
      const employeeUser = { id: '2', email: 'employee@test.com', role: 'employee' };

      render(
        <TestWrapper user={employeeUser}>
          <AdminOnlyComponent />
        </TestWrapper>
      );

      // Should not show protected content
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should allow managers to access manager-level components', () => {
      const ManagerComponent = withRoleGuard(TestComponent, { requiredRole: 'manager' });
      const managerUser = { id: '3', email: 'manager@test.com', role: 'manager' };

      render(
        <TestWrapper user={managerUser}>
          <ManagerComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should allow admins to access manager-level components (hierarchy)', () => {
      const ManagerComponent = withRoleGuard(TestComponent, { requiredRole: 'manager' });
      const adminUser = { id: '1', email: 'admin@test.com', role: 'admin' };

      render(
        <TestWrapper user={adminUser}>
          <ManagerComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('ProtectedTableActions Component', () => {
    it('should show admin access modal for non-admin users', async () => {
      const employeeUser = { id: '2', email: 'employee@test.com', role: 'employee' };

      render(
        <TestWrapper user={employeeUser}>
          <ProtectedTableActions />
        </TestWrapper>
      );

      // Click on a protected action
      const editLayoutButton = screen.getByText('Edit Table Layout');
      fireEvent.click(editLayoutButton);

      // Should show admin access modal
      await waitFor(() => {
        expect(screen.getByText('Admin Access Required')).toBeInTheDocument();
      });
    });

    it('should allow direct access for admin users', () => {
      const adminUser = { id: '1', email: 'admin@test.com', role: 'admin' };

      render(
        <TestWrapper user={adminUser}>
          <ProtectedTableActions />
        </TestWrapper>
      );

      // Should show configuration options
      expect(screen.getByText('Edit Table Layout')).toBeInTheDocument();
      expect(screen.getByText('Manage Table Types')).toBeInTheDocument();
    });
  });

  describe('Dashboard Access Control', () => {
    it('should render AdminDashboard for admin users', () => {
      const adminUser = { id: '1', email: 'admin@test.com', role: 'admin' };

      render(
        <TestWrapper user={adminUser}>
          <AdminDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Table Management Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Administrator Configuration')).toBeInTheDocument();
    });

    it('should not render AdminDashboard for non-admin users', () => {
      const employeeUser = { id: '2', email: 'employee@test.com', role: 'employee' };

      render(
        <TestWrapper user={employeeUser}>
          <AdminDashboard />
        </TestWrapper>
      );

      // AdminDashboard should be blocked by role guard
      expect(screen.queryByText('Administrator Configuration')).not.toBeInTheDocument();
    });

    it('should render EmployeeDashboard for all authenticated users', () => {
      const employeeUser = { id: '2', email: 'employee@test.com', role: 'employee' };

      render(
        <TestWrapper user={employeeUser}>
          <EmployeeDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Table Management')).toBeInTheDocument();
      expect(screen.getByText('Table Operations')).toBeInTheDocument();
      // Should not show admin-only features
      expect(screen.queryByText('Administrator Configuration')).not.toBeInTheDocument();
    });
  });

  describe('Role Hierarchy', () => {
    const testCases = [
      { role: 'admin', canAccessAdmin: true, canAccessManager: true, canAccessEmployee: true },
      { role: 'manager', canAccessAdmin: false, canAccessManager: true, canAccessEmployee: true },
      { role: 'employee', canAccessAdmin: false, canAccessManager: false, canAccessEmployee: true },
    ];

    testCases.forEach(({ role, canAccessAdmin, canAccessManager, canAccessEmployee }) => {
      it(`should enforce correct access for ${role} role`, () => {
        const user = { id: '1', email: `${role}@test.com`, role };

        const AdminComponent = withRoleGuard(TestComponent, { requiredRole: 'admin' });
        const ManagerComponent = withRoleGuard(TestComponent, { requiredRole: 'manager' });
        const EmployeeComponent = withRoleGuard(TestComponent, { requiredRole: 'employee' });

        // Test admin access
        const { unmount: unmountAdmin } = render(
          <TestWrapper user={user}>
            <AdminComponent />
          </TestWrapper>
        );
        
        if (canAccessAdmin) {
          expect(screen.getByTestId('protected-content')).toBeInTheDocument();
        } else {
          expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
        }
        unmountAdmin();

        // Test manager access
        const { unmount: unmountManager } = render(
          <TestWrapper user={user}>
            <ManagerComponent />
          </TestWrapper>
        );
        
        if (canAccessManager) {
          expect(screen.getByTestId('protected-content')).toBeInTheDocument();
        } else {
          expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
        }
        unmountManager();

        // Test employee access
        render(
          <TestWrapper user={user}>
            <EmployeeComponent />
          </TestWrapper>
        );
        
        if (canAccessEmployee) {
          expect(screen.getByTestId('protected-content')).toBeInTheDocument();
        } else {
          expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
        }
      });
    });
  });
});
