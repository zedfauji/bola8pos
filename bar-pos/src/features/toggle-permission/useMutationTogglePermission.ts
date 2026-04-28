/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
// Pre-regen cast: role_permissions table added in Phase 13; supabase.types.ts extended manually.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { rbacKeys } from '@entities/rbac';
import { logger } from '@shared/lib/logger-instance';
import type { StaffAction, StaffRole } from '@shared/lib/rbac';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

const db = supabase as any;

export interface TogglePermissionInput {
  role: StaffRole;
  action: StaffAction;
  enabled: boolean;
}

export function useMutationTogglePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      role,
      action,
      enabled,
    }: TogglePermissionInput): Promise<Result<null>> => {
      if (enabled) {
        const { error } = await db
          .from('role_permissions')
          .insert({ role, action })
          .select()
          .single();
        if (error) {
          logger.error('toggle-permission.enable.failed', { role, action, error });
          return err({
            code: 'SUPABASE_ERROR' as const,
            message:
              (error as { message?: string }).message ?? 'Failed to enable permission',
          });
        }
        return ok(null);
      }

      const { error } = await db
        .from('role_permissions')
        .delete()
        .eq('role', role)
        .eq('action', action);
      if (error) {
        logger.error('toggle-permission.disable.failed', { role, action, error });
        return err({
          code: 'SUPABASE_ERROR' as const,
          message:
            (error as { message?: string }).message ?? 'Failed to disable permission',
        });
      }
      return ok(null);
    },
    onSuccess: result => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: rbacKeys.list() });
      }
    },
  });
}
