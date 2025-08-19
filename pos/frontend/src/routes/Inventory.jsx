import React, { Suspense, Component } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { Box, Breadcrumbs, Typography, Paper, Tabs, Tab, Alert } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { InventoryProvider } from '../contexts/InventoryContext';
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
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={3}>
          <Alert severity="error">
            <Typography variant="h6">Failed to load component</Typography>
            <Typography variant="body2">{this.state.error?.message || 'Unknown error occurred'}</Typography>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Lazy load inventory components for better performance
const AdminDashboard = React.lazy(() => import('../pages/inventory/AdminDashboard'));
const EmployeeDashboard = React.lazy(() => import('../pages/inventory/EmployeeDashboard'));
const ProductsPage = React.lazy(() => import('../pages/inventory/products/ProductsPage'));
const MovementsPage = React.lazy(() => import('../pages/inventory/movements/MovementsPage'));
const SuppliersPage = React.lazy(() => import('../pages/inventory/suppliers/SuppliersPage'));
const PurchaseOrdersPage = React.lazy(() => import('../pages/inventory/purchase-orders/PurchaseOrdersPage'));
const StockCountPage = React.lazy(() => import('../pages/inventory/stock-count/StockCountPage'));

// Loading fallback component
const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </Box>
);

const Inventory = () => {
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
    <InventoryProvider>
      <Box sx={{ p: 3 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs 
          separator={<NavigateNextIcon fontSize="small" />} 
          aria-label="breadcrumb"
          sx={{ mb: 3 }}
        >
          <Link to="/" className="text-blue-400 hover:text-blue-600">
            Dashboard
          </Link>
          <Link to="/inventory" className="text-blue-400 hover:text-blue-600">
            Inventory
          </Link>
          {pathSegments.length > 1 && (
            <Typography color="text.primary" sx={{ textTransform: 'capitalize' }}>
              {pathSegments[1].replace('-', ' ')}
            </Typography>
          )}
        </Breadcrumbs>

        {/* Page Title */}
        <Typography variant="h4" component="h1" gutterBottom>
          Inventory Management
        </Typography>

        {/* Navigation Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs 
            value={getActiveTab()} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="inventory navigation tabs"
          >
            <Tab 
              label="Dashboard" 
              value="dashboard" 
              component={Link} 
              to="/inventory" 
            />
            <Tab 
              label="Products" 
              value="products" 
              component={Link} 
              to="/inventory/products" 
            />
            <Tab 
              label="Stock Movements" 
              value="movements" 
              component={Link} 
              to="/inventory/movements" 
            />
            <Tab 
              label="Suppliers" 
              value="suppliers" 
              component={Link} 
              to="/inventory/suppliers" 
            />
            <Tab 
              label="Purchase Orders" 
              value="purchase-orders" 
              component={Link} 
              to="/inventory/purchase-orders" 
            />
            <Tab 
              label="Stock Count" 
              value="stock-count" 
              component={Link} 
              to="/inventory/stock-count" 
            />
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
            <Route path="/products" element={
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <ProductsPage />
                </Suspense>
              </ErrorBoundary>
            } />
            <Route path="/movements" element={
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <MovementsPage />
                </Suspense>
              </ErrorBoundary>
            } />
            <Route path="/suppliers" element={
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <SuppliersPage />
                </Suspense>
              </ErrorBoundary>
            } />
            <Route path="/purchase-orders" element={
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <PurchaseOrdersPage />
                </Suspense>
              </ErrorBoundary>
            } />
            <Route path="/purchase-orders/new" element={
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <PurchaseOrdersPage isNew={true} />
                </Suspense>
              </ErrorBoundary>
            } />
            <Route path="/purchase-orders/:id" element={
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <PurchaseOrdersPage isDetail={true} />
                </Suspense>
              </ErrorBoundary>
            } />
            <Route path="/stock-count" element={
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <StockCountPage />
                </Suspense>
              </ErrorBoundary>
            } />
            <Route path="*" element={<Navigate to="/inventory" replace />} />
          </Routes>
        </Box>
      </Box>
    </InventoryProvider>
  );
};

export default Inventory;
