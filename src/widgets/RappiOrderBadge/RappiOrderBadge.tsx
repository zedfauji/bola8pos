import { useMemo } from 'react';
import { useRappiOrdersList } from '@entities/rappi-order';

/**
 * Pulsing badge count for Rappi orders awaiting acceptance.
 */
export function RappiOrderBadge() {
  const { data: res, isLoading } = useRappiOrdersList();

  const count = useMemo(() => {
    if (!res?.ok) return 0;
    return res.data.filter(o => o.status === 'pending_acceptance').length;
  }, [res]);

  if (isLoading || count === 0) return null;

  return (
    <span className="relative ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground animate-pulse">
      {count > 99 ? '99+' : count}
    </span>
  );
}
