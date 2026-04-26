import { ChefHat } from 'lucide-react';
import { Badge } from './badge';

export function ChefHatBadge() {
  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <ChefHat className="h-3 w-3" aria-hidden />
      Prep
    </Badge>
  );
}
