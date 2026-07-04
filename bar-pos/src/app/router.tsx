import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelpSheet } from '@widgets/HelpSheet';
import { AgentButton, AgentPanel } from '@features/agent-chat';
import { ProtectedRoute } from './ProtectedRoute';
import { AuditRoute } from './audit-route';
import { KdsRoute } from './kds-route';
import { RbacRoute } from './rbac-route';
import { ReportsRoute } from './reports-route';
import { WaitlistRoute } from './waitlist-route';

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
const WaitlistPage = lazy(() => import('../pages/waitlist'));
const RbacPage = lazy(() => import('../pages/rbac'));
const AuditPage = lazy(() => import('../pages/audit'));

function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}

export function Router() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <HelpSheet />
      <AgentButton />
      <AgentPanel />
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
                <KitchenPrepPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/waitlist"
            element={
              <ProtectedRoute>
                <WaitlistRoute>
                  <WaitlistPage />
                </WaitlistRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rbac"
            element={
              <ProtectedRoute>
                <RbacRoute>
                  <RbacPage />
                </RbacRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit"
            element={
              <ProtectedRoute>
                <AuditRoute>
                  <AuditPage />
                </AuditRoute>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
