import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Role hierarchy for permission checking
 * Higher index roles inherit permissions from lower index roles
 */
const ROLE_HIERARCHY = {
  'admin': 3,    // Highest level - can do everything
  'manager': 2,  // Can manage most things but not system settings
  'staff': 1,    // Basic access
  'guest': 0     // Minimal access
};

/**
 * Check if user role has sufficient privileges based on hierarchy
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role
 * @returns {boolean} True if user has sufficient privileges
 */
const hasRolePrivilege = (userRole, requiredRole) => {
  // If roles aren't in hierarchy, do direct comparison
  if (!(userRole in ROLE_HIERARCHY) || !(requiredRole in ROLE_HIERARCHY)) {
    return userRole === requiredRole;
  }
  
  // Check if user's role level is >= required role level
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

/**
 * Higher-Order Component that restricts access based on user role
 * 
 * @param {React.ComponentType} Component - Component to wrap
 * @param {Object} options - Configuration options
 * @param {string|string[]} options.requiredRoles - Role(s) required to access the component
 * @param {boolean} options.strict - If true, requires exact role match without hierarchy
 * @param {string} options.redirectTo - Path to redirect if unauthorized (default: '/unauthorized')
 * @param {string} options.minRole - Minimum role level required (alternative to requiredRoles)
 * @returns {React.ComponentType} Protected component
 */
const withRoleGuard = (Component, options = {}) => {
  const {
    requiredRoles = [],
    strict = false,
    redirectTo = '/unauthorized',
    minRole = null,
  } = options;

  // Convert single role to array
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  const WithRoleGuard = (props) => {
    const { isAuthenticated, user, loading } = useAuth();
    const location = useLocation();

    // Show loading state while checking auth
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated()) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const userRole = user?.role;
    let hasAccess = false;

    // Check if user has required role
    if (minRole) {
      // Use minimum role level check
      hasAccess = hasRolePrivilege(userRole, minRole);
    } else if (strict) {
      // Strict mode: require exact role match
      hasAccess = roles.includes(userRole);
    } else {
      // Hierarchy mode: check if user's role has sufficient privileges
      hasAccess = roles.some(role => hasRolePrivilege(userRole, role));
    }

    // If user doesn't have access, redirect to unauthorized page
    if (!hasAccess) {
      // Pass current location and required roles as state to unauthorized page
      return (
        <Navigate 
          to={redirectTo} 
          state={{ 
            from: location,
            requiredRoles: roles,
            userRole,
            strict,
            minRole
          }} 
          replace 
        />
      );
    }

    // If user has access, render the component
    return <Component {...props} />;
  };

  // Display name for debugging
  WithRoleGuard.displayName = `withRoleGuard(${Component.displayName || Component.name || 'Component'})`;

  return WithRoleGuard;
};

export default withRoleGuard;
