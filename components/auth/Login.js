import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';

// Role-based redirect paths
const ROLE_REDIRECTS = {
  admin: '/dashboard',
  manager: '/dashboard',
  staff: '/pos',
  default: '/pos'
};

export default function Login() {
  const [email, setEmail] = useState('admin@billiardpos.com');
  const [pinCode, setPinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [sessionData, setSessionData] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get redirect path from location state or default to '/'
  const from = location.state?.from?.pathname || '/';

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      try {
        const userData = JSON.parse(user);
        const redirectPath = getRedirectPath(userData.role);
        navigate(redirectPath, { replace: true });
      } catch (err) {
        // Invalid user data in localStorage, clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, [navigate]);

  // Get redirect path based on user role
  const getRedirectPath = (role) => {
    // If we have a specific from path, use that instead
    if (from !== '/') return from;
    
    // Otherwise use role-based redirect
    return ROLE_REDIRECTS[role] || ROLE_REDIRECTS.default;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // If showing 2FA input, verify the code
      if (showTwoFactor && sessionData) {
        const { data } = await api.post('/auth/verify-2fa', { 
          sessionId: sessionData.sessionId,
          code: twoFactorCode 
        });
        
        if (data.success) {
          // Store token and user data
          localStorage.setItem('token', data.data.token);
          localStorage.setItem('user', JSON.stringify(data.data.user));
          
          // Redirect based on role
          const redirectPath = getRedirectPath(data.data.user.role);
          navigate(redirectPath, { replace: true });
        } else {
          setError(data.message || 'Invalid verification code');
        }
      } else {
        // Initial login
        const { data } = await api.post('/auth/login', { email, pinCode });
        
        if (data.success) {
          // If 2FA is required
          if (data.data.requireTwoFactor) {
            setShowTwoFactor(true);
            setSessionData({
              sessionId: data.data.sessionId,
              email
            });
          } else {
            // No 2FA required, proceed with login
            localStorage.setItem('token', data.data.token);
            localStorage.setItem('user', JSON.stringify(data.data.user));
            
            // Redirect based on role
            const redirectPath = getRedirectPath(data.data.user.role);
            navigate(redirectPath, { replace: true });
          }
        } else {
          setError(data.message || 'Login failed');
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          'Login failed. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Billiard POS Login</h2>
          <p className="mt-2 text-sm text-gray-600">
            {showTwoFactor ? 'Enter verification code' : 'Enter your email and PIN code'}
          </p>
        </div>
        
        {error && (
          <div className="p-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {!showTwoFactor ? (
            // Initial login form
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <div>
                <label htmlFor="pinCode" className="block text-sm font-medium text-gray-700">
                  PIN Code
                </label>
                <input
                  id="pinCode"
                  name="pinCode"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="4"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={pinCode}
                  onChange={(e) => {
                    if (e.target.validity.valid) setPinCode(e.target.value);
                  }}
                  disabled={loading}
                />
              </div>
            </div>
          ) : (
            // Two-factor authentication form
            <div className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600">
                  A verification code has been sent to your email.
                </p>
                <p className="text-sm font-medium text-gray-800 mt-2">
                  {sessionData?.email}
                </p>
              </div>
              
              <div>
                <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                <input
                  id="twoFactorCode"
                  name="twoFactorCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="6"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={twoFactorCode}
                  onChange={(e) => {
                    if (e.target.validity.valid) setTwoFactorCode(e.target.value);
                  }}
                  disabled={loading}
                  autoFocus
                />
              </div>
              
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => {
                    setShowTwoFactor(false);
                    setSessionData(null);
                    setTwoFactorCode('');
                  }}
                  disabled={loading}
                >
                  Back to Login
                </button>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Processing...' : (showTwoFactor ? 'Verify' : 'Login')}
            </button>
          </div>
        </form>
        
        <div className="text-center text-sm text-gray-500">
          <p>Default admin: admin@billiardpos.com / 1234</p>
        </div>
      </div>
    </div>
  );
}
