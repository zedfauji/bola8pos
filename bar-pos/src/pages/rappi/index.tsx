import { RappiOrdersPanel } from '@widgets/RappiOrdersPanel';
import { LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function RappiOrdersPage() {
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title="Rappi delivery" backTo="/home" actions={<LiveTimeDisplay />}>
          <RappiOrdersPanel />
        </PageContainer>
      </main>
    </div>
  );
}
