import { RBACDashboard } from '@widgets/RBACDashboard';
import { BackToHomeButton, PageContainer } from '@shared/ui';

export default function RbacPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Roles & Permissions">
          <RBACDashboard />
        </PageContainer>
      </main>
    </div>
  );
}
