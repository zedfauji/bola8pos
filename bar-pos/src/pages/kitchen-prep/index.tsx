import { useTranslation } from 'react-i18next';
import { KitchenPrepDashboard } from '@widgets/KitchenPrepDashboard';
import { PageContainer } from '@shared/ui';

export default function KitchenPrepPage() {
  const { t } = useTranslation('pages');
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title={t('kitchenPrep.title')} backTo="/home">
          <KitchenPrepDashboard />
        </PageContainer>
      </main>
    </div>
  );
}
