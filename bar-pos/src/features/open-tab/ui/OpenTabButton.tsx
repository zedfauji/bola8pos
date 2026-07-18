/**
 * OPEN TAB BUTTON
 *
 * Triggers the open-tab flow using the currently logged-in staff member.
 * Requires an active shift — staff must clock in before opening tabs.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStaffStore } from '@entities/staff/model/store';
import { POSButton } from '@shared/ui/POSButton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { useOpenTab } from '../model/useOpenTab';

export function OpenTabButton() {
  const { t } = useTranslation('featOrders');
  const { openTab, isPending } = useOpenTab();
  const currentStaff = useStaffStore(s => s.currentStaff);
  const currentShift = useStaffStore(s => s.currentShift);
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [submitError, setSubmitError] = useState('');

  const canOpen = Boolean(currentStaff?.id && currentShift?.id);

  const handleOpenTab = async () => {
    if (!currentStaff?.id || !currentShift?.id) {
      setSubmitError(t('openTab.noActiveShiftInline'));
      return;
    }
    setSubmitError('');

    const result = await openTab({
      customerName: customerName.trim() || t('openTab.guestDefault'),
      tableNumber: tableNumber ? parseInt(tableNumber, 10) : null,
      staffId: currentStaff.id,
      shiftId: currentShift.id,
      status: 'open',
      notes: null,
      items: [],
    });

    if (result.ok) {
      setIsOpen(false);
      setCustomerName('');
      setTableNumber('');
    } else {
      setSubmitError(result.error.message);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        setIsOpen(open);
        if (!open) {
          setSubmitError('');
        }
      }}
    >
      <DialogTrigger asChild>
        <POSButton touchSize="large" variant="default" disabled={!currentStaff}>
          {t('openTab.openTabLabel')}
        </POSButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('openTab.title')}</DialogTitle>
          <DialogDescription>{t('openTab.descriptionButton')}</DialogDescription>
        </DialogHeader>

        {!canOpen && (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            {t('openTab.noActiveShiftBanner')}
          </p>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="customerName">{t('openTab.customerNameLabel')}</Label>
            <Input
              id="customerName"
              placeholder={t('openTab.guestDefault')}
              value={customerName}
              onChange={e => {
                setCustomerName(e.target.value);
              }}
              disabled={isPending || !canOpen}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tableNumber">{t('openTab.tableNumberLabel')}</Label>
            <Input
              id="tableNumber"
              type="number"
              min="1"
              max="200"
              placeholder={t('openTab.tableNumberPlaceholderButton')}
              value={tableNumber}
              onChange={e => {
                setTableNumber(e.target.value);
              }}
              disabled={isPending || !canOpen}
            />
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>
        <DialogFooter>
          <POSButton
            touchSize="large"
            variant="default"
            onClick={() => {
              void handleOpenTab();
            }}
            disabled={isPending || !canOpen}
          >
            {isPending ? t('openTab.opening') : t('openTab.openTabLabel')}
          </POSButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
