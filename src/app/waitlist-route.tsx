import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@entities/staff/model/usePermissions';

type WaitlistRouteProps = {
  children: ReactNode;
};

export function WaitlistRoute({ children }: WaitlistRouteProps) {
  const { can } = usePermissions();
  if (!can('manage_waitlist')) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
