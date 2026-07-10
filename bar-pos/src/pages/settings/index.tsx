import { SettingsTabsPanel } from '@widgets/SettingsTabsPanel';
import { PageContainer } from '@shared/ui';

export default function SettingsPage() {
  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-auto">
        <PageContainer title="Settings" backTo="/home">
          <SettingsTabsPanel />
        </PageContainer>
      </main>
    </div>
  );
}
