import { CajaDashboard } from '@widgets/CajaDashboard';
import { StaffDashboard } from '@widgets/StaffDashboard/StaffDashboard';
import { BackToHomeButton } from '@shared/ui';

export default function StaffPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <h1 className="mb-6 text-3xl font-bold">Staff</h1>
        <div className="mx-auto max-w-6xl space-y-8">
          <CajaDashboard />
          <StaffDashboard />
        </div>
      </main>
    </div>
  );
}
