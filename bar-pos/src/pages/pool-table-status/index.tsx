import { ChevronLeft } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { TableStatusPanel } from '@widgets/TableStatusPanel';
import { PageContainer } from '@shared/ui/PageContainer';
import { Button } from '@shared/ui/button';

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
      <div className="px-4 pt-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/pool-tables">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Pool Tables
          </Link>
        </Button>
      </div>
      <main className="flex-1 overflow-auto">
        <PageContainer title="Table Status">
          <TableStatusPanel tableId={tableId} />
        </PageContainer>
      </main>
    </div>
  );
}
