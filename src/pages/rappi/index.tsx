import { AppNav } from '@widgets/AppNav/ui/AppNav';
import { RappiOrdersPanel } from '@widgets/RappiOrdersPanel';
import { LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function RappiOrdersPage() {
  return (
    <div className="flex h-screen">
      <AppNav />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Rappi delivery" actions={<LiveTimeDisplay />}>
          <RappiOrdersPanel />
        </PageContainer>
      </main>
    </div>
  );
}
