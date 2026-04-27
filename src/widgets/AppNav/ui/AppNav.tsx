import {
  Home,
  Clock,
  CreditCard,
  Package,
  Users,
  BarChart,
  Menu,
  LogOut,
  Receipt,
  Settings,
  Bike,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RappiOrderBadge } from '@widgets/RappiOrderBadge';
import { useLoginUiStore } from '@entities/staff/model/loginUiStore';
import { useStaffStore } from '@entities/staff/model/store';
import { usePermissions } from '@entities/staff/model/usePermissions';
import { useTabStore } from '@entities/tab/model/store';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@shared/ui/sheet';

type NavPermission = 'adjust_inventory' | 'view_reports' | 'manage_settings' | 'close_tab';

type NavItem = {
  path: string;
  label: string;
  icon: typeof Home;
  permission?: NavPermission;
};

const navItems: NavItem[] = [
  { path: '/pos', label: 'POS Register', icon: Home },
  { path: '/payments', label: 'Payments', icon: CreditCard, permission: 'close_tab' },
  { path: '/rappi', label: 'Rappi', icon: Bike },
  { path: '/pool-tables', label: 'Pool Tables', icon: Clock },
  { path: '/inventory', label: 'Inventory', icon: Package, permission: 'adjust_inventory' },
  { path: '/staff', label: 'Staff', icon: Users },
  { path: '/reports', label: 'Reports', icon: BarChart, permission: 'view_reports' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'manage_settings' },
];

interface NavContentProps {
  location: { pathname: string };
  items: NavItem[];
  profile: { name: string; role: string } | null;
  handleLogout: () => void;
  onItemClick?: () => void;
}

function NavContent({ location, items, profile, handleLogout, onItemClick }: NavContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-1 p-4">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={onItemClick}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className="relative w-full justify-start pr-10"
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
                {item.path === '/rappi' ? (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2">
                    <RappiOrderBadge />
                  </span>
                ) : null}
              </Button>
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              useTabStore.getState().openDrawer();
              onItemClick?.();
            }}
          >
            <Receipt className="mr-2 h-4 w-4" />
            Open Tabs
          </Button>
        </div>
      </div>

      {profile && (
        <div className="border-t p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{profile.name}</p>
              <Badge variant="outline" className="mt-1">
                {profile.role}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      )}
    </div>
  );
}

export function AppNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentStaff = useStaffStore(s => s.currentStaff);
  const { can } = usePermissions();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const profile = currentStaff ? { name: currentStaff.name, role: currentStaff.role } : null;

  const visibleNavItems = navItems.filter(item => {
    if (!item.permission) return true;
    if (item.path === '/settings') {
      return can('manage_settings') || can('manage_products');
    }
    return can(item.permission);
  });

  const handleLogout = () => {
    useStaffStore.getState().logout();
    useLoginUiStore.getState().clearSelection();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Navigation */}
      <div className="fixed top-0 z-50 flex w-full items-center border-b bg-background p-4 md:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <NavContent
              location={location}
              items={visibleNavItems}
              profile={profile}
              handleLogout={handleLogout}
              onItemClick={() => {
                setIsMobileOpen(false);
              }}
            />
          </SheetContent>
        </Sheet>
        <h1 className="ml-4 text-lg font-semibold">Bar POS</h1>
      </div>

      {/* Desktop Navigation */}
      <aside className="hidden h-screen w-64 border-r bg-card md:block">
        <div className="p-4">
          <h1 className="text-xl font-bold">Bar POS</h1>
        </div>
        <NavContent
          location={location}
          items={visibleNavItems}
          profile={profile}
          handleLogout={handleLogout}
        />
      </aside>
    </>
  );
}
