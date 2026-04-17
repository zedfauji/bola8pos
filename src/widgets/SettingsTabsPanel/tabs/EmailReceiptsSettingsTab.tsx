import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  useEmailSettingsStatus,
  useMutationSendSettingsTestEmail,
  useMutationUpdateSetting,
  useSettings,
} from '@entities/settings';
import type { UserRole } from '@shared/lib/domain';
import { Input, Label, POSButton, ProtectedAction } from '@shared/ui';

type Props = {
  currentRole: UserRole | null;
};

export function EmailReceiptsSettingsTab({ currentRole }: Props) {
  const { data } = useSettings();
  const emailStatus = useEmailSettingsStatus();
  const updateSetting = useMutationUpdateSetting();
  const sendTest = useMutationSendSettingsTestEmail();
  const [fromEmail, setFromEmail] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data || dirty) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setFromEmail(data.emailReceipts.fromEmail);
    if (testRecipient.length === 0) {
      setTestRecipient(data.emailReceipts.fromEmail);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data, dirty, testRecipient.length]);

  const save = async () => {
    const result = await updateSetting.mutateAsync({
      key: 'email_receipts',
      value: {
        fromEmail: fromEmail.trim(),
      },
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setDirty(false);
    toast.success('Email receipt settings saved.');
  };

  const sendTestEmail = async () => {
    const result = await sendTest.mutateAsync({ email: testRecipient.trim() });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Test email sent.');
  };

  return (
    <ProtectedAction
      action="manage_settings"
      currentRole={currentRole}
      disabled={updateSetting.isPending}
    >
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Email Receipts</h2>
        <div className="space-y-2">
          <Label htmlFor="settings-receipt-from-email">From email address</Label>
          <Input
            id="settings-receipt-from-email"
            value={fromEmail}
            onChange={event => {
              setDirty(true);
              setFromEmail(event.target.value);
            }}
          />
        </div>
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <span className="font-medium">Resend API key:</span>{' '}
          {emailStatus.data?.resendConfigured ? 'configured' : 'not set'}
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-test-email-recipient">Test recipient</Label>
          <Input
            id="settings-test-email-recipient"
            value={testRecipient}
            onChange={event => {
              setTestRecipient(event.target.value);
            }}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <POSButton
            type="button"
            touchSize="large"
            disabled={!dirty || updateSetting.isPending || sendTest.isPending}
            onClick={() => {
              void save();
            }}
          >
            {updateSetting.isPending ? 'Saving...' : 'Save Email Settings'}
          </POSButton>
          <POSButton
            type="button"
            touchSize="large"
            variant="outline"
            disabled={sendTest.isPending || updateSetting.isPending}
            onClick={() => {
              void sendTestEmail();
            }}
          >
            {sendTest.isPending ? 'Sending...' : 'Send Test Email'}
          </POSButton>
        </div>
      </div>
    </ProtectedAction>
  );
}
