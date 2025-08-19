import React, { ComponentType } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

interface RoleGuardOptions {
  requireAdminLogin?: boolean;
  fallbackComponent?: ComponentType;
  requiredRole?: 'admin' | 'manager' | 'employee';
}

interface AdminAccessModalProps {
  open: boolean;
  onClose: () => void;
  onAdminLogin: () => void;
}

const AdminAccessModal: React.FC<AdminAccessModalProps> = ({ open, onClose, onAdminLogin }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <AdminPanelSettingsIcon color="primary" />
          <Typography variant="h6">Admin Access Required</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" align="center" sx={{ mb: 2 }}>
          This action requires administrator privileges. Please log in as an administrator to continue.
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          Configuration changes such as table layout editing, tariff management, and system settings are restricted to administrators only.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button onClick={onAdminLogin} variant="contained" color="primary">
          Admin Login
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Higher-order component that guards components based on user role
 * @param WrappedComponent - The component to guard
 * @param options - Configuration options for the guard
 */
export function withRoleGuard<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: RoleGuardOptions = {}
) {
  const {
    requireAdminLogin = false,
    fallbackComponent: FallbackComponent,
    requiredRole = 'admin'
  } = options;

  const GuardedComponent: React.FC<P> = (props) => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [showAdminModal, setShowAdminModal] = React.useState(false);

    // Check if user is authenticated
    if (!isAuthenticated() || !user) {
      if (FallbackComponent) {
        return <FallbackComponent {...props} />;
      }
      return null;
    }

    // Check role hierarchy: admin > manager > employee
    const hasRequiredRole = () => {
      if (!user.role) return false;
      
      const userRole = user.role.toLowerCase();
      
      switch (requiredRole) {
        case 'admin':
          return userRole === 'admin';
        case 'manager':
          return userRole === 'admin' || userRole === 'manager';
        case 'employee':
          return userRole === 'admin' || userRole === 'manager' || userRole === 'employee';
        default:
          return false;
      }
    };

    // If user doesn't have required role
    if (!hasRequiredRole()) {
      if (requireAdminLogin) {
        // Show admin access modal
        return (
          <>
            <AdminAccessModal
              open={showAdminModal}
              onClose={() => setShowAdminModal(false)}
              onAdminLogin={() => {
                setShowAdminModal(false);
                navigate('/login?returnTo=' + encodeURIComponent(window.location.pathname));
              }}
            />
            {/* Render a button or trigger that opens the modal */}
            <Box sx={{ display: 'none' }}>
              <Button onClick={() => setShowAdminModal(true)}>
                Trigger Admin Access
              </Button>
            </Box>
          </>
        );
      }

      // Silent block - return fallback or null
      if (FallbackComponent) {
        return <FallbackComponent {...props} />;
      }
      return null;
    }

    // User has required role, render the component
    return <WrappedComponent {...props} />;
  };

  GuardedComponent.displayName = `withRoleGuard(${WrappedComponent.displayName || WrappedComponent.name})`;

  return GuardedComponent;
}

/**
 * Hook to check if current user has required role and trigger admin modal if needed
 */
export const useRoleGuard = (requiredRole: 'admin' | 'manager' | 'employee' = 'admin') => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showAdminModal, setShowAdminModal] = React.useState(false);

  const hasRequiredRole = () => {
    if (!isAuthenticated() || !user?.role) return false;
    
    const userRole = user.role.toLowerCase();
    
    switch (requiredRole) {
      case 'admin':
        return userRole === 'admin';
      case 'manager':
        return userRole === 'admin' || userRole === 'manager';
      case 'employee':
        return userRole === 'admin' || userRole === 'manager' || userRole === 'employee';
      default:
        return false;
    }
  };

  const checkAccess = (callback?: () => void) => {
    if (hasRequiredRole()) {
      callback?.();
      return true;
    } else {
      setShowAdminModal(true);
      return false;
    }
  };

  const AdminModal = () => (
    <AdminAccessModal
      open={showAdminModal}
      onClose={() => setShowAdminModal(false)}
      onAdminLogin={() => {
        setShowAdminModal(false);
        navigate('/login?returnTo=' + encodeURIComponent(window.location.pathname));
      }}
    />
  );

  return {
    hasRequiredRole: hasRequiredRole(),
    checkAccess,
    AdminModal
  };
};

export default withRoleGuard;
