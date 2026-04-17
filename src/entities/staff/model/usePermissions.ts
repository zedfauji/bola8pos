import { useCallback, useMemo } from 'react';
import { canAccess } from '@shared/lib/rbac';
import { useStaffStore } from './store';

export function usePermissions(): { can: (action: string) => boolean } {
  const role = useStaffStore(s => s.currentStaff?.role);

  const can = useCallback((action: string) => canAccess(role, action), [role]);

  return useMemo(() => ({ can }), [can]);
}
