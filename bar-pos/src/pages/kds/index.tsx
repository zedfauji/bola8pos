import { KdsBoard } from '@widgets/KdsBoard';
import { LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function KdsPage() {
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title="Kitchen Display" backTo="/home" actions={<LiveTimeDisplay />}>
          <KdsBoard routing="KITCHEN" />
        </PageContainer>
      </main>
    </div>
  );
}
