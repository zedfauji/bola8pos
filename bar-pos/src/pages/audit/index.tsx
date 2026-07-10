import { AuditLogTable } from '@widgets/AuditLogTable';
import { PageContainer } from '@shared/ui';

export default function AuditPage() {
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title="Audit Log" backTo="/home">
          <AuditLogTable />
        </PageContainer>
      </main>
    </div>
  );
}
