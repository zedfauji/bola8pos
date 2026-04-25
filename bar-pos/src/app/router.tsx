import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelpSheet } from '@widgets/HelpSheet';
import { ProtectedRoute } from './ProtectedRoute';
import { KdsRoute } from './kds-route';
import { KitchenPrepRoute } from './kitchen-prep-route';
import { ReportsRoute } from './reports-route';

const LoginPage = lazy(() => import('../pages/login'));
const HomePage = lazy(() => import('../pages/home'));
const PosPage = lazy(() => import('../pages/pos'));
const PoolTablesPage = lazy(() => import('../pages/pool-tables'));
const InventoryPage = lazy(() => import('../pages/inventory'));
const StaffPage = lazy(() => import('../pages/staff'));
const ReportsPage = lazy(() => import('../pages/reports'));
const SettingsPage = lazy(() => import('../pages/settings'));
const RappiOrdersPage = lazy(() => import('../pages/rappi'));
const TableStatusPage = lazy(() => import('../pages/pool-table-status'));
const PaymentsPage = lazy(() => import('../pages/payments'));
const KdsPage = lazy(() => import('../pages/kds'));
const KitchenPrepPage = lazy(() => import('../pages/kitchen-prep'));

function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}

export function Router() {
  return (
    <BrowserRouter>
      <HelpSheet />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <PosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pool-tables"
            element={
              <ProtectedRoute>
                <PoolTablesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <InventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsRoute>
                  <ReportsPage />
                </ReportsRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rappi"
            element={
              <ProtectedRoute>
                <RappiOrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pool-tables/:tableId"
            element={
              <ProtectedRoute>
                <TableStatusPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <PaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kds"
            element={
              <ProtectedRoute>
                <KdsRoute>
                  <KdsPage />
                </KdsRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kitchen-prep"
            element={
              <ProtectedRoute>
                <KitchenPrepRoute>
                  <KitchenPrepPage />
                </KitchenPrepRoute>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
