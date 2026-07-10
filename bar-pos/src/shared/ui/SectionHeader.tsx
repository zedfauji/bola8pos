/**
 * SECTION HEADER COMPONENT
 *
 * Consistent page/section headers with optional action and badge.
 */

import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@shared/lib/utils';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';

export type SectionHeaderProps = {
  /** Section title */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional action button or element */
  action?: React.ReactNode;
  /** Optional badge (count or label) */
  badge?: string | number;
  /** Additional CSS classes */
  className?: string;
  /** Optional back-navigation target. Omit to render no back link. */
  backTo?: string;
  /** Optional back-link label. Defaults to "Home" when backTo is provided. */
  backLabel?: string;
};

/**
 * Section header with title, description, action, and badge.
 *
 * @example
 * ```tsx
 * <SectionHeader
 *   title="Open Tabs"
 *   description="Currently active customer tabs"
 *   badge={5}
 *   action={<Button>New Tab</Button>}
 * />
 * ```
 */
export function SectionHeader({
  title,
  description,
  action,
  badge,
  className,
  backTo,
  backLabel,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b pb-4', className)}>
      <div className="space-y-1">
        {backTo && (
          <Button variant="ghost" size="sm" asChild className="-ml-2.5 h-6 px-2 text-xs">
            <Link to={backTo}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              {backLabel ?? 'Home'}
            </Link>
          </Button>
        )}
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {badge !== undefined && (
            <Badge variant="secondary" aria-label={`Count: ${String(badge)}`}>
              {badge}
            </Badge>
          )}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>

      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
