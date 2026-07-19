import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { TableStatusPanel } from '@widgets/TableStatusPanel';
import { PageContainer } from '@shared/ui/PageContainer';

export default function TableStatusPage() {
  const { t } = useTranslation('pages');
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!tableId) {
      navigate('/pool-tables');
    }
  }, [tableId, navigate]);

  if (!tableId) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer
          title={t('poolTableStatus.title')}
          backTo="/pool-tables"
          backLabel={t('poolTableStatus.backLabel')}
        >
          <TableStatusPanel tableId={tableId} />
        </PageContainer>
      </main>
    </div>
  );
}
