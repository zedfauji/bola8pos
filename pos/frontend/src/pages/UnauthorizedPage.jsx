// UnauthorizedPage component for role-specific access denied messages
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldExclamationIcon, ArrowLeftIcon, HomeIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

/**
 * Role-specific messages for unauthorized access
 */
const ROLE_MESSAGES = {
  admin: {
    title: 'System Access Restricted',
    message: 'This area requires special system privileges. Please contact the system administrator for access.',
    actionText: 'Return to Admin Dashboard',
    actionPath: '/dashboard'
  },
  manager: {
    title: 'Manager Access Restricted',
    message: 'This area requires admin privileges. Please contact your administrator if you need access to this feature.',
    actionText: 'Return to Manager Dashboard',
    actionPath: '/dashboard'
  },
  staff: {
    title: 'Staff Access Restricted',
    message: 'This area requires manager or admin privileges. Please contact your manager if you need to perform this action.',
    actionText: 'Return to POS',
    actionPath: '/pos'
  },
  guest: {
    title: 'Access Restricted',
    message: 'You need to be logged in with appropriate permissions to access this area.',
    actionText: 'Return to Login',
    actionPath: '/login'
  },
  default: {
    title: 'Access Denied',
    message: 'You do not have permission to access this page. Please contact your administrator if you believe this is an error.',
    actionText: 'Return to Home',
    actionPath: '/'
  }
};

const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const location = useLocation();
  
  // Get information from location state (passed by withRoleGuard)
  const requiredRoles = location.state?.requiredRoles || [];
  const userRole = location.state?.userRole || user?.role || 'guest';
  const minRole = location.state?.minRole;
  
  // Get role-specific content
  // Use a valid role or fall back to default
  const validRole = Object.keys(ROLE_MESSAGES).includes(userRole) ? userRole : 'default';
  const roleContent = ROLE_MESSAGES[validRole];
  
  // Generate message about required roles
  const getRoleRequirementMessage = () => {
    if (minRole) {
      return `This page requires at least ${minRole} privileges.`;
    } else if (requiredRoles.length > 0) {
      return `This page requires one of these roles: ${requiredRoles.join(', ')}.`;
    }
    return '';
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoToSuggested = () => {
    navigate(roleContent.actionPath);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-red-600 p-6">
          <div className="flex items-center justify-center">
            <ShieldExclamationIcon className="h-12 w-12 text-white" />
          </div>
          <h2 className="mt-4 text-center text-2xl font-bold text-white">
            {roleContent.title}
          </h2>
        </div>

        <div className="p-6">
          <p className="text-gray-700 mb-4 text-center">
            {roleContent.message}
          </p>
          
          {getRoleRequirementMessage() && (
            <p className="text-sm text-gray-500 mb-6 text-center border-t border-b border-gray-200 py-2">
              {getRoleRequirementMessage()}
            </p>
          )}

          <div className="flex flex-col space-y-3 mt-6">
            <button
              onClick={handleGoBack}
              className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 flex items-center justify-center"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Go Back
            </button>
            
            <button
              onClick={handleGoToSuggested}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
            >
              <HomeIcon className="h-5 w-5 mr-2" />
              {roleContent.actionText}
            </button>
            
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center justify-center"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
