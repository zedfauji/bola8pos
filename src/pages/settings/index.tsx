import { SettingsTabsPanel } from '@widgets/SettingsTabsPanel';
import { BackToHomeButton } from '@shared/ui';

export default function SettingsPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <SettingsTabsPanel />
        </div>
      </main>
    </div>
  );
}
