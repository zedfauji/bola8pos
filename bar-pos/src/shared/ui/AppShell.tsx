/**
 * APP SHELL COMPONENT
 *
 * Main application layout wrapper with responsive sidebar.
 */

import { Menu } from 'lucide-react';
import * as React from 'react';

import { cn } from '@shared/lib/utils';

import { Button } from './button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';

export interface AppShellProps {
  /** Main content */
  children: React.ReactNode;
  /** Optional sidebar content */
  sidebar?: React.ReactNode;
  /** Optional header content */
  header?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AppShell - Main application layout
 *
 * Features:
 * - Desktop (â‰¥1024px): fixed left sidebar (240px) + main content
 * - Tablet (768â€“1024px): collapsible sidebar via Sheet
 * - Mobile (<768px): collapsible sidebar via Sheet
 * - Dark theme applied to entire app
 * - Sticky header support
 *
 * @example
 * ```tsx
 * <AppShell
 *   sidebar={<Navigation />}
 *   header={<TopBar />}
 * >
 *   <Routes />
 * </AppShell>
 * ```
 */
export function AppShell({ children, sidebar, header, className }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className={cn('flex h-screen w-full bg-background', className)}>
      {/* Desktop Sidebar (â‰¥1024px) */}
      {sidebar && (
        <aside className="hidden w-60 border-r bg-card lg:block">
          <div className="flex h-full flex-col">{sidebar}</div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        {header && (
          <header className="sticky top-0 z-40 border-b bg-background">
            <div className="flex h-16 items-center gap-4 px-4">
              {/* Mobile Menu Button */}
              {sidebar && (
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      aria-label="Open menu"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-60 p-0">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Navigation Menu</SheetTitle>
                      <SheetDescription>Navigate through the application</SheetDescription>
                    </SheetHeader>
                    <div className="flex h-full flex-col">{sidebar}</div>
                  </SheetContent>
                </Sheet>
              )}

              {/* Header Content */}
              <div className="flex flex-1 items-center justify-between">{header}</div>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
