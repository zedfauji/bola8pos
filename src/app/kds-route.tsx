import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@entities/staff/model/usePermissions';

type KdsRouteProps = {
  children: ReactNode;
};

export function KdsRoute({ children }: KdsRouteProps) {
  const { can } = usePermissions();
  if (!can('view_kds')) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
