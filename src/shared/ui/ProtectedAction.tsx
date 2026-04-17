import type { ReactNode } from 'react';
import type { UserRole } from '@shared/lib/domain';

const ACTION_ROLE_MAP = {
  void_order: ['manager', 'admin'],
  manage_pool_tables: ['admin'],
} as const satisfies Record<string, readonly UserRole[]>;

type ProtectedActionName = keyof typeof ACTION_ROLE_MAP;

export type ProtectedActionProps = {
  /** Roles that may see and use the wrapped action */
  allowedRoles?: readonly UserRole[];
  /** Action mapped to allowed roles */
  action?: ProtectedActionName;
  currentRole: UserRole | null | undefined;
  children: ReactNode;
  /** Shown when the current role is not allowed (defaults to nothing) */
  fallback?: ReactNode;
};

/**
 * Renders children only when currentRole is permitted.
 * Caller supplies role from staff/auth state — this component stays free of entity imports.
 */
export function ProtectedAction({
  allowedRoles,
  action,
  currentRole,
  children,
  fallback = null,
}: ProtectedActionProps) {
  const resolvedAllowedRoles = action ? ACTION_ROLE_MAP[action] : allowedRoles;
  const hasRoleConstraint = Array.isArray(resolvedAllowedRoles) && resolvedAllowedRoles.length > 0;
  if (!hasRoleConstraint) return <>{fallback}</>;

  const allowedRoleSet = resolvedAllowedRoles as readonly UserRole[];
  const isAllowed = currentRole != null && allowedRoleSet.includes(currentRole);
  if (!isAllowed) return <>{fallback}</>;
  return <>{children}</>;
}
