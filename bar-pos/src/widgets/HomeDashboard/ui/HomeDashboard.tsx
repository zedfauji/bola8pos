import {
  BarChart,
  Beer,
  Bike,
  ChefHat,
  ClipboardList,
  Clock,
  CreditCard,
  Home,
  ListOrdered,
  Lock,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ManagerPinDialog } from '@features/manager-pin-gate';
import { useStaffStore } from '@entities/staff/model/store';
import { usePermissions } from '@entities/staff/model/usePermissions';
import { useWaitlistWaitingCount } from '@entities/waitlist';
import type { StaffAction } from '@shared/lib/rbac';
import { Badge, Button } from '@shared/ui';

type DashboardItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  requiredAction?: StaffAction;
  managerLabel?: string;
  /** If set, only these roles can see this item. All roles see it when undefined. */
  visibleToRoles?: string[];
};

const ITEMS: DashboardItem[] = [
  { path: '/pos', label: 'POS Register', icon: Home },
  { path: '/payments', label: 'Payments', icon: CreditCard },
  { path: '/pool-tables', label: 'Pool Tables', icon: Clock },
  { path: '/rappi', label: 'Rappi Orders', icon: Bike },
  { path: '/staff', label: 'Staff', icon: Users },
  {
    path: '/reports',
    label: 'Reports',
    icon: BarChart,
    requiredAction: 'view_reports',
    managerLabel: 'Manager',
  },
  {
    path: '/inventory',
    label: 'Inventory',
    icon: Package,
    requiredAction: 'adjust_inventory',
    managerLabel: 'Manager',
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    requiredAction: 'manage_settings',
    managerLabel: 'Admin',
  },
  {
    path: '/kitchen-prep',
    label: 'Kitchen Prep',
    icon: ChefHat,
    requiredAction: 'produce_prep_batch',
    managerLabel: 'Manager',
  },
  {
    path: '/waitlist',
    label: 'Waitlist',
    icon: ListOrdered,
    requiredAction: 'manage_waitlist',
    managerLabel: 'Manager',
  },
  {
    path: '/rbac',
    label: 'Roles & Permissions',
    icon: ShieldCheck,
    requiredAction: 'manage_staff',
    managerLabel: 'Admin',
  },
  {
    path: '/audit',
    label: 'Audit Log',
    icon: ClipboardList,
    requiredAction: 'view_audit_log',
    managerLabel: 'Manager',
  },
  {
    path: '/kds',
    label: 'Kitchen Display',
    icon: UtensilsCrossed,
    visibleToRoles: ['admin', 'kitchen'],
  },
  {
    path: '/kds-bar',
    label: 'Bar Display',
    icon: Beer,
    requiredAction: 'view_kds_bar',
    managerLabel: 'Bartender',
  },
];

type GatedTarget = { action: StaffAction; path: string };

export function HomeDashboard() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const currentStaff = useStaffStore(s => s.currentStaff);
  const logout = useStaffStore(s => s.logout);
  const grantManagerActions = useStaffStore(s => s.grantManagerActions);
  const [gatedTarget, setGatedTarget] = useState<GatedTarget | null>(null);
  const { data: waitingCount = 0 } = useWaitlistWaitingCount();

  function handleItemClick(item: DashboardItem) {
    if (!item.requiredAction || can(item.requiredAction)) {
      navigate(item.path);
    } else {
      setGatedTarget({ action: item.requiredAction, path: item.path });
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex w-full flex-col items-center justify-center gap-8 p-8">
      {/* Staff context */}
      {currentStaff && (
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold">Welcome, {currentStaff.name}</span>
          <Badge variant="secondary" className="capitalize">
            {currentStaff.role}
          </Badge>
        </div>
      )}

      {/* Navigation grid */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {ITEMS.filter(
          item =>
            !item.visibleToRoles ||
            (currentStaff?.role != null && item.visibleToRoles.includes(currentStaff.role))
        ).map(item => {
          const isGated = !!item.requiredAction && !can(item.requiredAction);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                handleItemClick(item);
              }}
              className="relative flex min-h-[160px] min-w-[160px] flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-6 shadow transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={item.label}
              data-testid={item.path === '/audit' ? 'home-tile-audit' : undefined}
            >
              {isGated && (
                <Lock
                  className="absolute right-3 top-3 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                  data-testid="lock-icon"
                />
              )}
              <div className="relative">
                <Icon className="h-12 w-12" />
                {item.path === '/waitlist' && waitingCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-1 -top-1 h-5 min-w-[20px] rounded-full px-1 text-xs"
                    aria-label={`Waitlist: ${String(waitingCount)} parties waiting`}
                  >
                    {waitingCount > 99 ? '99+' : waitingCount}
                  </Badge>
                )}
              </div>
              <span className="text-center text-sm font-medium">{item.label}</span>
              {isGated && item.managerLabel && (
                <Badge variant="secondary" className="text-xs">
                  {item.managerLabel}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Logout */}
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>

      {/* Manager PIN gate dialog */}
      <ManagerPinDialog
        open={gatedTarget !== null}
        onOpenChange={open => {
          if (!open) setGatedTarget(null);
        }}
        requiredAction={gatedTarget?.action ?? 'view_reports'}
        onSuccess={() => {
          if (!gatedTarget) return;
          // Grant this action so route-level guards see it as permitted
          grantManagerActions([gatedTarget.action]);
          const path = gatedTarget.path;
          setGatedTarget(null);
          navigate(path);
        }}
      />
    </div>
  );
}
