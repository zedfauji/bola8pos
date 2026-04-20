import { CajaReportPanel } from '@widgets/CajaReportPanel';
import { BackToHomeButton } from '@shared/ui';

export default function ReportsPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <CajaReportPanel />
      </main>
    </div>
  );
}
