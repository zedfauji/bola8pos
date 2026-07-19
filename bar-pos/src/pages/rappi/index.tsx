import { useTranslation } from 'react-i18next';
import { RappiOrdersPanel } from '@widgets/RappiOrdersPanel';
import { LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function RappiOrdersPage() {
  const { t } = useTranslation('pages');
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title={t('rappi.title')} backTo="/home" actions={<LiveTimeDisplay />}>
          <RappiOrdersPanel />
        </PageContainer>
      </main>
    </div>
  );
}
