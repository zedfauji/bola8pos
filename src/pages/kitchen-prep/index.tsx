import { KitchenPrepDashboard } from '@widgets/KitchenPrepDashboard';
import { BackToHomeButton, PageContainer } from '@shared/ui';

export default function KitchenPrepPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Kitchen Prep">
          <KitchenPrepDashboard />
        </PageContainer>
      </main>
    </div>
  );
}
