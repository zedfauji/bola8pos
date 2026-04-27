import { PoolTableGrid } from '@widgets/PoolTableGrid';
import { BackToHomeButton, LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function PoolTablesPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Pool Tables" actions={<LiveTimeDisplay />}>
          <PoolTableGrid />
        </PageContainer>
      </main>
    </div>
  );
}
