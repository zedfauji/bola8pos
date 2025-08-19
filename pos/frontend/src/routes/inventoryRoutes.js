import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import InventoryPage from '../pages/InventoryPage';
import ProductsPage from '../pages/ProductsPage';
import ProductDetailsPage from '../pages/ProductDetailsPage';
import CategoriesPage from '../pages/CategoriesPage';
import SuppliersPage from '../pages/SuppliersPage';
import LocationsPage from '../pages/LocationsPage';
import StockMovementsPage from '../pages/StockMovementsPage';
import PurchaseOrdersPage from '../pages/PurchaseOrdersPage';
import InventoryAlertsPage from '../pages/InventoryAlertsPage';

const inventoryRoutes = [
  <Route 
    key="inventory" 
    path="/inventory" 
    element={<ProtectedRoute roles={['admin', 'manager', 'staff']}><InventoryPage /></ProtectedRoute>} 
  />,
  <Route 
    key="inventory-products" 
    path="/inventory/products" 
    element={<ProtectedRoute roles={['admin', 'manager', 'staff']}><ProductsPage /></ProtectedRoute>} 
  />,
  <Route 
    key="inventory-product-details" 
    path="/inventory/products/:id" 
    element={<ProtectedRoute roles={['admin', 'manager', 'staff']}><ProductDetailsPage /></ProtectedRoute>} 
  />,
  <Route 
    key="inventory-categories" 
    path="/inventory/categories" 
    element={<ProtectedRoute roles={['admin', 'manager']}><CategoriesPage /></ProtectedRoute>} 
  />,
  <Route 
    key="inventory-suppliers" 
    path="/inventory/suppliers" 
    element={<ProtectedRoute roles={['admin', 'manager']}><SuppliersPage /></ProtectedRoute>} 
  />,
  <Route 
    key="inventory-locations" 
    path="/inventory/locations" 
    element={<ProtectedRoute roles={['admin', 'manager']}><LocationsPage /></ProtectedRoute>} 
  />,
  <Route 
    key="inventory-stock-movements" 
    path="/inventory/stock-movements" 
    element={<ProtectedRoute roles={['admin', 'manager']}><StockMovementsPage /></ProtectedRoute>} 
  />,
  <Route 
    key="inventory-purchase-orders" 
    path="/inventory/purchase-orders" 
    element={<ProtectedRoute roles={['admin', 'manager']}><PurchaseOrdersPage /></ProtectedRoute>} 
  />,
  <Route 
    key="inventory-alerts" 
    path="/inventory/alerts" 
    element={<ProtectedRoute roles={['admin', 'manager']}><InventoryAlertsPage /></ProtectedRoute>} 
  />
];

export default inventoryRoutes;
