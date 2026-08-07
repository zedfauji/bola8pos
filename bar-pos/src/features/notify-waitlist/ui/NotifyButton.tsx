import { BellRing } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LoadingSpinner, POSButton } from '@shared/ui';
import { useNotifyWaitlist } from '../model/useNotifyWaitlist';

export interface NotifyButtonProps {
  entryId: string;
  entryName: string;
  hasPhone: boolean;
}

export function NotifyButton({ entryId, entryName, hasPhone }: NotifyButtonProps) {
  const { t } = useTranslation('featMgmt');
  const { notifyEntry, isPending } = useNotifyWaitlist();

  async function handleNotify() {
    await notifyEntry({ entryId, entryName, hasPhone });
  }

  return (
    <POSButton
      variant="outline"
      touchSize="default"
      disabled={isPending}
      onClick={() => { void handleNotify(); }}
      aria-label={
        hasPhone
          ? t('notifyWaitlist.sendWhatsappAria')
          : t('notifyWaitlist.sendManagerAria')
      }
    >
      {isPending ? (
        <LoadingSpinner size={16} className="p-0" />
      ) : (
        <>
          <BellRing className="size-4 mr-1" aria-hidden="true" />
          {hasPhone ? t('notifyWaitlist.notifyViaWhatsapp') : t('notifyWaitlist.notifyManager')}
        </>
      )}
    </POSButton>
  );
}
