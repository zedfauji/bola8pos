import { PoolTableGrid } from '@widgets/PoolTableGrid';
import { LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function PoolTablesPage() {
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title="Pool Tables" backTo="/home" actions={<LiveTimeDisplay />}>
          <PoolTableGrid />
        </PageContainer>
      </main>
    </div>
  );
}
