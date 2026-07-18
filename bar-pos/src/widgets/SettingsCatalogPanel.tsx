import { useTranslation } from 'react-i18next';
import {
  CatalogCategoriesTab,
  CatalogModifiersTab,
  CatalogProductsTab,
} from '@features/manage-products';
import { useStaffStore } from '@entities/staff/model/store';
import { ProtectedAction } from '@shared/ui/ProtectedAction';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';

export function SettingsCatalogPanel() {
  const { t } = useTranslation('wAdmin');
  const currentRole = useStaffStore(s => s.currentStaff?.role);

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-semibold">{t('settingsCatalogPanel.title')}</h2>
        <p className="text-muted-foreground text-sm">
          {t('settingsCatalogPanel.description')}
        </p>
      </div>

      <ProtectedAction action="manage_products" currentRole={currentRole}>
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <Tabs defaultValue="products" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="products">{t('settingsCatalogPanel.tabProducts')}</TabsTrigger>
              <TabsTrigger value="categories">
                {t('settingsCatalogPanel.tabCategories')}
              </TabsTrigger>
              <TabsTrigger value="modifiers">{t('settingsCatalogPanel.tabModifiers')}</TabsTrigger>
            </TabsList>
            <TabsContent value="products" className="min-h-[12rem]">
              <CatalogProductsTab />
            </TabsContent>
            <TabsContent value="categories" className="min-h-[12rem]">
              <CatalogCategoriesTab />
            </TabsContent>
            <TabsContent value="modifiers" className="min-h-[12rem]">
              <CatalogModifiersTab />
            </TabsContent>
          </Tabs>
        </fieldset>
      </ProtectedAction>
    </section>
  );
}
