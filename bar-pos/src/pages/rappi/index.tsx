import { RappiOrdersPanel } from '@widgets/RappiOrdersPanel';
import { BackToHomeButton, LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function RappiOrdersPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Rappi delivery" actions={<LiveTimeDisplay />}>
          <RappiOrdersPanel />
        </PageContainer>
      </main>
    </div>
  );
}
