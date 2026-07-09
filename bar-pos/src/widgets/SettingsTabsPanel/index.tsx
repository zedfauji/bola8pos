import { useMemo, type ReactNode } from 'react';
import { ManageIngredientsTab } from '@widgets/ManageIngredientsTab';
import { ManageCombosTab } from '@features/manage-combos';
import { useStaffStore } from '@entities/staff/model/store';
import { usePermissions } from '@entities/staff/model/usePermissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { BackupSettingsTab } from './tabs/BackupSettingsTab';
import { BillingSettingsTab } from './tabs/BillingSettingsTab';
import { EmailReceiptsSettingsTab } from './tabs/EmailReceiptsSettingsTab';
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab';
import { HardwareSettingsTab } from './tabs/HardwareSettingsTab';
import { PoolTablesSettingsTab } from './tabs/PoolTablesSettingsTab';
import { ProductsSettingsTab } from './tabs/ProductsSettingsTab';
import { RappiSettingsTab } from './tabs/RappiSettingsTab';
import { TipDistributionSettingsTab } from './tabs/TipDistributionSettingsTab';

type TabItem = {
  key: string;
  label: string;
  render: () => ReactNode;
};

export function SettingsTabsPanel() {
  const currentRole = useStaffStore(s => s.currentStaff?.role ?? null);
  const { can } = usePermissions();
  const canManageSettings = can('manage_settings');
  const canManageProducts = can('manage_products');

  const tabs = useMemo<TabItem[]>(() => {
    const out: TabItem[] = [];
    if (canManageSettings) {
      out.push(
        {
          key: 'general',
          label: 'General',
          render: () => <GeneralSettingsTab currentRole={currentRole} />,
        },
        {
          key: 'hardware',
          label: 'Hardware',
          render: () => <HardwareSettingsTab currentRole={currentRole} />,
        },
        {
          key: 'rappi',
          label: 'Rappi',
          render: () => <RappiSettingsTab currentRole={currentRole} />,
        },
        {
          key: 'email',
          label: 'Email Receipts',
          render: () => <EmailReceiptsSettingsTab currentRole={currentRole} />,
        },
        {
          key: 'backup',
          label: 'Backup',
          render: () => <BackupSettingsTab currentRole={currentRole} />,
        },
        {
          key: 'tip-split',
          label: 'Tip Split',
          render: () => <TipDistributionSettingsTab currentRole={currentRole} />,
        }
      );
    }
    if (canManageProducts) {
      out.push(
        {
          key: 'products',
          label: 'Products',
          render: () => <ProductsSettingsTab currentRole={currentRole} />,
        },
        {
          key: 'pool',
          label: 'Pool Tables',
          render: () => <PoolTablesSettingsTab currentRole={currentRole} />,
        },
        {
          key: 'billing',
          label: 'Billing',
          render: () => <BillingSettingsTab currentRole={currentRole} />,
        },
        {
          key: 'combos',
          label: 'Combos',
          render: () => <ManageCombosTab />,
        },
        {
          key: 'ingredients',
          label: 'Ingredients',
          render: () => <ManageIngredientsTab />,
        }
      );
    }
    return out;
  }, [canManageProducts, canManageSettings, currentRole]);

  const firstTab = tabs[0];
  if (!firstTab) {
    return (
      <section className="rounded-lg border p-4 text-sm text-muted-foreground">
        You do not have permission to view settings.
      </section>
    );
  }
  const defaultTab = firstTab.key;

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="mb-4 flex h-auto w-full flex-wrap items-center justify-start gap-2 rounded-md bg-muted p-1">
          {tabs.map(tab => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(tab => (
          <TabsContent key={tab.key} value={tab.key} className="min-h-[14rem]">
            {tab.render()}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
