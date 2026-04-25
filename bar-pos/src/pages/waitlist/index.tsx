import { WaitlistQueue } from '@widgets/WaitlistQueue';
import { PoolTableOccupancyPanel } from '@widgets/PoolTableOccupancyPanel';
import { BackToHomeButton, PageContainer } from '@shared/ui';

export default function WaitlistPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Waitlist">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="flex-1">
              <WaitlistQueue />
            </div>
            <div className="min-w-[200px]">
              <PoolTableOccupancyPanel />
            </div>
          </div>
        </PageContainer>
      </main>
    </div>
  );
}
