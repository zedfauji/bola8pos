import { KdsBoard } from '@widgets/KdsBoard';
import { LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function KdsBarPage() {
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title="Bar Display" backTo="/home" actions={<LiveTimeDisplay />}>
          <KdsBoard routing="BAR" />
        </PageContainer>
      </main>
    </div>
  );
}
