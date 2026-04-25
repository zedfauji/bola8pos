import { BellRing } from 'lucide-react';

import { Button, LoadingSpinner } from '@shared/ui';
import { useNotifyWaitlist } from '../model/useNotifyWaitlist';

export interface NotifyButtonProps {
  entryId: string;
  entryName: string;
  hasPhone: boolean;
}

export function NotifyButton({ entryId, entryName, hasPhone }: NotifyButtonProps) {
  const { notifyEntry, isPending } = useNotifyWaitlist();

  async function handleNotify() {
    await notifyEntry({ entryId, entryName, hasPhone });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => { void handleNotify(); }}
      aria-label={hasPhone ? 'Send WhatsApp notification' : 'Send manager notification'}
    >
      {isPending ? (
        <LoadingSpinner size={16} className="p-0" />
      ) : (
        <>
          <BellRing className="h-4 w-4 mr-1" aria-hidden="true" />
          {hasPhone ? 'Notify via WhatsApp' : 'Notify manager'}
        </>
      )}
    </Button>
  );
}
