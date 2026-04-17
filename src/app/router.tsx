import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { ReportsRoute } from './reports-route';

const LoginPage = lazy(() => import('../pages/login'));
const PosPage = lazy(() => import('../pages/pos'));
const PoolTablesPage = lazy(() => import('../pages/pool-tables'));
const InventoryPage = lazy(() => import('../pages/inventory'));
const StaffPage = lazy(() => import('../pages/staff'));
const ReportsPage = lazy(() => import('../pages/reports'));
const SettingsPage = lazy(() => import('../pages/settings'));
const RappiOrdersPage = lazy(() => import('../pages/rappi'));

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
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/pos" replace />} />
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
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
