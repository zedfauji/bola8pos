import { AppNav } from '@widgets/AppNav/ui/AppNav';

export default function InventoryPage() {
  return (
    <div className="flex h-screen">
      <AppNav />
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <h1 className="mb-6 text-3xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">Inventory management coming soon...</p>
      </main>
    </div>
  );
}
