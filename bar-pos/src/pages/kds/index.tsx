import { useTranslation } from 'react-i18next';
import { KdsBoard } from '@widgets/KdsBoard';
import { LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function KdsPage() {
  const { t } = useTranslation('pages');
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title={t('kds.title')} backTo="/home" actions={<LiveTimeDisplay />}>
          <KdsBoard routing="KITCHEN" />
        </PageContainer>
      </main>
    </div>
  );
}
