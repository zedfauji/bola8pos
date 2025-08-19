import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute component that restricts access based on user permissions
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children Child components to render if authorized
 * @param {string} [props.requiredPermission] Permission required to access the route
 * @param {string[]} [props.allowedRoles] Roles allowed to access the route
 * @param {string} [props.redirectTo] Path to redirect to if unauthorized
 */
const ProtectedRoute = ({ 
  children, 
  requiredPermission, 
  allowedRoles = [], 
  redirectTo = '/login' 
}) => {
  const { isAuthenticated, hasPermission, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated()) {
    // Redirect to login if not authenticated
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check for specific permission if provided
  if (requiredPermission && !hasPermission(requiredPermission)) {
    // Check if user has any of the allowed roles
    const hasAllowedRole = allowedRoles.length > 0 && 
      user?.role && 
      allowedRoles.includes(user.role);
    
    if (!hasAllowedRole) {
      // Redirect to unauthorized page or dashboard
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // User is authenticated and authorized
  return children;
};

export default ProtectedRoute;
