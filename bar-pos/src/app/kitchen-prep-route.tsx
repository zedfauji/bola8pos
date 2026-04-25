import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@entities/staff/model/usePermissions';

type KitchenPrepRouteProps = {
  children: ReactNode;
};

export function KitchenPrepRoute({ children }: KitchenPrepRouteProps) {
  const { can } = usePermissions();
  if (!can('produce_prep_batch')) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
