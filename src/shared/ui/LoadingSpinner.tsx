import { Loader2 } from 'lucide-react';
import { cn } from '@shared/lib/utils';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

export function LoadingSpinner({ size = 24, className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn('flex items-center justify-center p-4', className)}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <Loader2 className="animate-spin text-primary" size={size} aria-hidden="true" />
      <span className="sr-only">Loading tab details...</span>
    </div>
  );
}
