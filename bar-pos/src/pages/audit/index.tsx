import { AuditLogTable } from '@widgets/AuditLogTable';
import { BackToHomeButton } from '@shared/ui';
import { SectionHeader } from '@shared/ui/SectionHeader';

export default function AuditPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <SectionHeader title="Audit Log" />
          <AuditLogTable />
        </div>
      </main>
    </div>
  );
}
