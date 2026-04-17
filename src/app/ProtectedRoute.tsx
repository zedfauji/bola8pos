import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useStaffStore } from '@entities/staff/model/store';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useStaffStore(s => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
