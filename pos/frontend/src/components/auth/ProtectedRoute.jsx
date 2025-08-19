import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ProtectedRoute component that redirects to login if not authenticated
 * and checks for required permissions if specified.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render if authorized
 * @param {string|string[]} [props.requiredPermission] - Required permission(s) to access the route
 * @param {string} [props.redirectTo] - Path to redirect if not authorized (default: '/login')
 * @param {boolean} [props.requireAdmin] - If true, requires admin role
 * @returns {React.ReactNode} Rendered component or redirect
 */
const ProtectedRoute = ({
  children,
  requiredPermission,
  redirectTo = '/login',
  requireAdmin = false,
}) => {
  const { isAuthenticated, user, hasPermission, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Show loading state while checking auth
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated()) {
    // Store the attempted URL to redirect after login
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check if admin access is required (accepts roles that contain 'admin', e.g., 'Administrator')
  if (requireAdmin && !(typeof user?.role === 'string' && /admin/i.test(user.role))) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  // Check for required permissions
  if (requiredPermission) {
    const requiredPermissions = Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission];

    const hasRequiredPermission = requiredPermissions.some(permission => 
      hasPermission(permission)
    );

    if (!hasRequiredPermission) {
      return <Navigate to="/unauthorized" state={{ from: location }} replace />;
    }
  }

  // If all checks pass, render the children
  return children;
};

export default ProtectedRoute;
