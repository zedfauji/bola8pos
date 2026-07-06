import { Beer, UtensilsCrossed } from 'lucide-react';
import type { CategoryRouting } from '@shared/lib/domain';
import { Badge } from './badge';

export function RoutingBadge({ routing }: { routing: CategoryRouting }) {
  if (routing === 'NONE') return null;
  const Icon = routing === 'KITCHEN' ? UtensilsCrossed : Beer;
  const label = routing === 'KITCHEN' ? 'Kitchen' : 'Bar';
  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
