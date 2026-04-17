import { AppNav } from '@widgets/AppNav/ui/AppNav';
import { PoolTableGrid } from '@widgets/PoolTableGrid';
import { LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function PoolTablesPage() {
  return (
    <div className="flex h-screen">
      <AppNav />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Pool Tables" actions={<LiveTimeDisplay />}>
          <PoolTableGrid />
        </PageContainer>
      </main>
    </div>
  );
}
