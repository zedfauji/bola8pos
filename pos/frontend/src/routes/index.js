import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';

// Pages
import LoginPage from '../pages/LoginPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';
import Dashboard from './Dashboard';
import Tables from './Tables';
import Orders from './Orders';
import Inventory from './Inventory';
import Loyalty from './Loyalty';
import Employees from './Employees';
import KDS from './KDS';

// Layout
import Layout from '../components/Layout';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      
      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route 
          path="tables" 
          element={
            <ProtectedRoute requiredPermission="tables:read">
              <Tables />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="orders" 
          element={
            <ProtectedRoute requiredPermission="orders:read">
              <Orders />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="inventory" 
          element={
            <ProtectedRoute requiredPermission="inventory:read">
              <Inventory />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="loyalty" 
          element={
            <ProtectedRoute requiredPermission="loyalty:read">
              <Loyalty />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="employees" 
          element={
            <ProtectedRoute requiredPermission="employees:read" requireAdmin>
              <Employees />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="kds" 
          element={
            <ProtectedRoute requiredPermission="kds:read">
              <KDS />
            </ProtectedRoute>
          } 
        />
      </Route>
      
      {/* Catch all route - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
