/**
 * SECTION HEADER COMPONENT
 *
 * Consistent page/section headers with optional action and badge.
 */

import { cn } from '@shared/lib/utils';
import { Badge } from '@shared/ui/badge';

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
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b pb-4', className)}>
      <div className="space-y-1">
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
