import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  callCreateSettingsBackup,
  callRappiMenuSync,
  callRestoreSettingsBackup,
  callSendSettingsTestEmail,
  callSettingsEmailStatus,
} from '@shared/lib/edge-function-contracts';
import { logger } from '@shared/lib/logger-instance';
import {
  err,
  ok,
  supabaseMutation,
  supabaseQuery,
  unknownError,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Tables, TablesInsert } from '@shared/lib/supabase.types';
import {
  BillingSettingsSchema,
  EmailReceiptSettingsSchema,
  GeneralSettingsSchema,
  PaymentMethodLabelsSchema,
  RappiSettingsSchema,
  ReceiptSettingsSchema,
  SettingsBackupSummarySchema,
  type BillingSettings,
  type EmailReceiptSettings,
  type GeneralSettings,
  type PaymentMethodLabels,
  type RappiSettings,
  type ReceiptSettings,
  type SettingsBackupSummary,
  type SettingsKey,
} from './types';

const DEFAULT_GENERAL: GeneralSettings = {
  barName: 'Bola 8',
  address: '',
  timezone: 'America/Mexico_City',
  currency: 'MXN',
  receiptFooterText: '',
};

const DEFAULT_BILLING: BillingSettings = {
  taxRatePercent: 16,
  defaultTipPercentages: [10, 15, 18, 20],
  paymentMethods: { cash: true, bbvaCard: true, rappi: true },
};

const DEFAULT_RAPPI: RappiSettings = {
  storeId: '',
  lastSyncAt: null,
};

const DEFAULT_EMAIL_RECEIPTS: EmailReceiptSettings = {
  fromEmail: '',
};

const DEFAULT_PAYMENT_LABELS: PaymentMethodLabels = {
  cash: 'Efectivo',
  card: 'Terminal BBVA',
  rappi: 'Rappi',
};

const DEFAULT_RECEIPT: ReceiptSettings = {
  paperWidthChars: 32,
  showCashierName: true,
  showCustomerName: true,
  showReceiptNumber: true,
  headerLine2: '',
  footerText: '',
  boldTotals: true,
};

export type SettingsSnapshot = {
  general: GeneralSettings;
  billing: BillingSettings;
  rappi: RappiSettings;
  emailReceipts: EmailReceiptSettings;
  paymentLabels: PaymentMethodLabels;
  receipt: ReceiptSettings;
};

export const settingsKeys = {
  all: ['settings'] as const,
  backups: () => [...settingsKeys.all, 'backups'] as const,
  emailStatus: () => [...settingsKeys.all, 'email-status'] as const,
};

type SettingsRow = Tables<'settings'>;
type SettingsInsert = TablesInsert<'settings'>;

const SETTINGS_KEYS: SettingsKey[] = [
  'general',
  'billing',
  'rappi',
  'email_receipts',
  'pool_tables',
  'payment_labels',
  'receipt',
];

function parseGeneral(value: unknown): GeneralSettings {
  const parsed = GeneralSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_GENERAL;
}

function parseBilling(value: unknown): BillingSettings {
  const parsed = BillingSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_BILLING;
}

function parseRappi(value: unknown): RappiSettings {
  const parsed = RappiSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_RAPPI;
}

function parseEmailReceipts(value: unknown): EmailReceiptSettings {
  const parsed = EmailReceiptSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_EMAIL_RECEIPTS;
}

function parsePaymentLabels(value: unknown): PaymentMethodLabels {
  const parsed = PaymentMethodLabelsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_PAYMENT_LABELS;
}

function parseReceipt(value: unknown): ReceiptSettings {
  const parsed = ReceiptSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_RECEIPT;
}

function parseBackup(row: Tables<'settings_backups'>): Result<SettingsBackupSummary> {
  try {
    return ok(
      SettingsBackupSummarySchema.parse({
        id: row.id,
        label: row.label,
        createdAt: row.created_at,
        createdBy: row.created_by,
        restoredAt: row.restored_at,
        restoredBy: row.restored_by,
      })
    );
  } catch (error) {
    return err(unknownError(error));
  }
}

function toSnapshot(rows: SettingsRow[]): SettingsSnapshot {
  const byKey = new Map(rows.map(row => [row.key, row.value] as const));
  const snapshot: SettingsSnapshot = {
    general: parseGeneral(byKey.get('general')),
    billing: parseBilling(byKey.get('billing')),
    rappi: parseRappi(byKey.get('rappi')),
    emailReceipts: parseEmailReceipts(byKey.get('email_receipts')),
    paymentLabels: parsePaymentLabels(byKey.get('payment_labels')),
    receipt: parseReceipt(byKey.get('receipt')),
  };
  return snapshot;
}

export function useSettings() {
  const query = useQuery({
    queryKey: settingsKeys.all,
    queryFn: async (): Promise<Result<SettingsSnapshot>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('settings')
          .select('*')
          .in('key', SETTINGS_KEYS)
          .order('updated_at', { ascending: false })
      );
      if (!res.ok) {
        logger.error('settings.fetch_failed', { message: res.error.message, code: res.error.code });
        return res;
      }

      return ok(toSnapshot(res.data));
    },
    staleTime: 30 * 1000,
  });

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

export function useMutationUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: SettingsKey;
      value:
        | GeneralSettings
        | BillingSettings
        | RappiSettings
        | EmailReceiptSettings
        | PaymentMethodLabels
        | ReceiptSettings
        | Record<string, unknown>;
    }): Promise<Result<void>> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const payload: SettingsInsert = {
        key,
        value: value as unknown as TablesInsert<'settings'>['value'],
        updated_by: user?.id ?? null,
      };

      const res = await supabaseMutation(() =>
        supabase.from('settings').upsert(payload, { onConflict: 'key' }).select('id').single()
      );
      if (!res.ok) {
        logger.error('settings.update_failed', {
          key,
          message: res.error.message,
          code: res.error.code,
        });
        return res;
      }
      return ok(undefined);
    },
    onSuccess: result => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      }
    },
  });
}

export function useSettingsBackups() {
  const query = useQuery({
    queryKey: settingsKeys.backups(),
    queryFn: async (): Promise<Result<SettingsBackupSummary[]>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('settings_backups')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(25)
      );
      if (!res.ok) {
        return res;
      }
      const backups: SettingsBackupSummary[] = [];
      for (const row of res.data) {
        const parsed = parseBackup(row);
        if (!parsed.ok) return parsed;
        backups.push(parsed.data);
      }
      return ok(backups);
    },
  });

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

export function useMutationCreateSettingsBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => callCreateSettingsBackup({ label }),
    onSuccess: result => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: settingsKeys.backups() });
      }
    },
  });
}

export function useMutationRestoreSettingsBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ backupId }: { backupId: string }) =>
      callRestoreSettingsBackup({ backupId }),
    onSuccess: result => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
        void queryClient.invalidateQueries({ queryKey: settingsKeys.backups() });
      }
    },
  });
}

export function useMutationSyncRappiMenu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => callRappiMenuSync(),
    onSuccess: result => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      }
    },
  });
}

export function useEmailSettingsStatus() {
  const query = useQuery({
    queryKey: settingsKeys.emailStatus(),
    queryFn: async () => callSettingsEmailStatus(),
    staleTime: 60 * 1000,
  });
  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

export function useMutationSendSettingsTestEmail() {
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => callSendSettingsTestEmail({ email }),
  });
}
