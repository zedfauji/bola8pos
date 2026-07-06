import { KdsBoard } from '@widgets/KdsBoard';
import { BackToHomeButton, LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function KdsBarPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Bar Display" actions={<LiveTimeDisplay />}>
          <KdsBoard routing="BAR" />
        </PageContainer>
      </main>
    </div>
  );
}
