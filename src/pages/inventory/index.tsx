import { InventoryPagePanel } from '@widgets/InventoryPagePanel';
import { BackToHomeButton } from '@shared/ui';

export default function InventoryPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <h1 className="mb-6 text-3xl font-bold">Inventory</h1>
        <InventoryPagePanel />
      </main>
    </div>
  );
}
