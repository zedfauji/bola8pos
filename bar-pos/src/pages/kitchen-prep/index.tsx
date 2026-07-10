import { KitchenPrepDashboard } from '@widgets/KitchenPrepDashboard';
import { PageContainer } from '@shared/ui';

export default function KitchenPrepPage() {
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title="Kitchen Prep" backTo="/home">
          <KitchenPrepDashboard />
        </PageContainer>
      </main>
    </div>
  );
}
