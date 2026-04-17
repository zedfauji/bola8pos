import { Home, Clock, Package, Users, BarChart, Menu, LogOut, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@entities/staff/model/AuthContext';
import { useTabStore } from '@entities/tab/model/store';
import { supabase } from '@shared/lib/supabase';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@shared/ui/sheet';

const navItems = [
  { path: '/pos', label: 'POS Register', icon: Home },
  { path: '/pool-tables', label: 'Pool Tables', icon: Clock },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/staff', label: 'Staff', icon: Users },
  { path: '/reports', label: 'Reports', icon: BarChart },
];

interface NavContentProps {
  location: { pathname: string };
  profile: { name: string; role: string } | null;
  handleLogout: () => Promise<void>;
  onItemClick?: () => void;
}

function NavContent({ location, profile, handleLogout, onItemClick }: NavContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-1 p-4">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={onItemClick}>
              <Button variant={isActive ? 'secondary' : 'ghost'} className="w-full justify-start">
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
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
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              void handleLogout();
            }}
          >
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
  const { profile, currentShift, setCurrentShift } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = async () => {
    // Clock out current shift
    if (currentShift) {
      await supabase
        .from('shifts')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', currentShift.id);
      setCurrentShift(null);
    }

    await supabase.auth.signOut();
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
        <NavContent location={location} profile={profile} handleLogout={handleLogout} />
      </aside>
    </>
  );
}
