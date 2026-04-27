/**
 * PAGE CONTAINER COMPONENT
 *
 * Consistent page wrapper with title, description, and actions slot.
 */

import * as React from 'react';

import { cn } from '@shared/lib/utils';

import { SectionHeader } from './SectionHeader';

export interface PageContainerProps {
  /** Page content */
  children: React.ReactNode;
  /** Page title */
  title: string;
  /** Optional page description */
  description?: string;
  /** Optional actions slot (e.g., buttons) */
  actions?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PageContainer - Consistent page wrapper
 *
 * Features:
 * - Max width constraint (1400px)
 * - Consistent padding (24px)
 * - Renders SectionHeader at top
 * - Actions slot for page-level buttons
 *
 * @example
 * ```tsx
 * <PageContainer
 *   title="Open Tabs"
 *   description="Currently active customer tabs"
 *   actions={<Button>New Tab</Button>}
 * >
 *   <TabList tabs={tabs} />
 * </PageContainer>
 * ```
 */
export function PageContainer({
  children,
  title,
  description,
  actions,
  className,
}: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-[1400px] space-y-6 p-6', className)}>
      {/* Page Header */}
      <SectionHeader
        title={title}
        {...(description && { description })}
        {...(actions && { action: actions })}
      />

      {/* Page Content */}
      {children}
    </div>
  );
}
