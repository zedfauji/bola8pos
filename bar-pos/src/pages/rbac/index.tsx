import { RBACDashboard } from '@widgets/RBACDashboard';
import { PageContainer } from '@shared/ui';

export default function RbacPage() {
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title="Roles & Permissions" backTo="/home">
          <RBACDashboard />
        </PageContainer>
      </main>
    </div>
  );
}
