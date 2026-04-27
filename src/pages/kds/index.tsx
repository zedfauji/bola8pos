import { KdsBoard } from '@widgets/KdsBoard';
import { BackToHomeButton, LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function KdsPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Kitchen Display" actions={<LiveTimeDisplay />}>
          <KdsBoard />
        </PageContainer>
      </main>
    </div>
  );
}
