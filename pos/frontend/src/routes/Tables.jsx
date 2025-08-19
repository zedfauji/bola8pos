import React, { Suspense, Component } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { Box, Breadcrumbs, Typography, Paper, Tabs, Tab, Alert } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

// Error Boundary component for catching lazy loading errors
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error in component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            <Typography variant="h6">Something went wrong</Typography>
            <Typography variant="body2">{this.state.error?.message || 'Unknown error'}</Typography>
            <Button 
              variant="outlined" 
              size="small" 
              sx={{ mt: 1 }}
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </Button>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Lazy load table management components for better performance
const AdminDashboard = React.lazy(() => import('../pages/tables/AdminDashboard'));
const EmployeeDashboard = React.lazy(() => import('../pages/tables/EmployeeDashboard'));
const TableLayout = React.lazy(() => import('../pages/tables/TableLayout'));
const TableLayoutEditor = React.lazy(() => import('../pages/tables/TableLayoutEditor'));
const ReservationsPage = React.lazy(() => import('../pages/tables/Reservations'));
const TableTypesPage = React.lazy(() => import('../pages/tables/TableTypes'));
const FloorsPage = React.lazy(() => import('../pages/tables/Floors'));
const TableSettingsPage = React.lazy(() => import('../pages/tables/Settings'));

// Loading fallback component
const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </Box>
);

const Tables = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const { user } = useAuth();
  
  // Determine active tab based on current path
  const getActiveTab = () => {
    const path = pathSegments[1] || 'dashboard';
    return path;
  };

  // Handle tab change
  const handleTabChange = (_, newValue) => {
    // No need to set state, we'll navigate to the new route
  };
  
  // Determine which dashboard to show based on user role
  const isAdmin = user?.role === 'admin';

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs 
        separator={<NavigateNextIcon fontSize="small" />} 
        aria-label="breadcrumb"
        sx={{ mb: 3 }}
      >
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          Home
        </Link>
        <Typography color="text.primary">Tables</Typography>
        {pathSegments.length > 1 && (
          <Typography color="text.primary" sx={{ textTransform: 'capitalize' }}>
            {pathSegments[1]}
          </Typography>
        )}
      </Breadcrumbs>

      {/* Tabs Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={getActiveTab()} 
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="table management tabs"
        >
          <Tab 
            label="Dashboard" 
            value="dashboard" 
            component={Link} 
            to="/tables" 
          />
          <Tab 
            label="Layout" 
            value="layout" 
            component={Link} 
            to="/tables/layout" 
          />
          <Tab 
            label="Reservations" 
            value="reservations" 
            component={Link} 
            to="/tables/reservations" 
          />
          {isAdmin && (
            <Tab 
              label="Table Types" 
              value="types" 
              component={Link} 
              to="/tables/types" 
            />
          )}
          {isAdmin && (
            <Tab 
              label="Floors" 
              value="floors" 
              component={Link} 
              to="/tables/floors" 
            />
          )}
          {isAdmin && (
            <Tab 
              label="Settings" 
              value="settings" 
              component={Link} 
              to="/tables/settings" 
            />
          )}
        </Tabs>
      </Paper>

      {/* Routes */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Routes>
          <Route path="/" element={
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                {isAdmin ? (
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                ) : (
                  <ProtectedRoute allowedRoles={['employee', 'manager']}>
                    <EmployeeDashboard />
                  </ProtectedRoute>
                )}
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="/layout" element={
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <TableLayout />
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="/layout/edit" element={
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <TableLayoutEditor />
                </ProtectedRoute>
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="/reservations/*" element={
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <ReservationsPage />
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="/types" element={
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute allowedRoles={['admin']}>
                  <TableTypesPage />
                </ProtectedRoute>
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="/floors" element={
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute allowedRoles={['admin']}>
                  <FloorsPage />
                </ProtectedRoute>
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="/settings" element={
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute allowedRoles={['admin']}>
                  <TableSettingsPage />
                </ProtectedRoute>
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="*" element={<Navigate to="/tables" replace />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default Tables;
