import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@entities/staff/model/usePermissions';

type KdsBarRouteProps = {
  children: ReactNode;
};

export function KdsBarRoute({ children }: KdsBarRouteProps) {
  const { can } = usePermissions();
  if (!can('view_kds_bar')) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
