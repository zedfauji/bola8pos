import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { TableStatusPanel } from '@widgets/TableStatusPanel';
import { PageContainer } from '@shared/ui/PageContainer';

export default function TableStatusPage() {
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
        <PageContainer title="Table Status" backTo="/pool-tables" backLabel="Pool Tables">
          <TableStatusPanel tableId={tableId} />
        </PageContainer>
      </main>
    </div>
  );
}
