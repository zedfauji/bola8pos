import { ActiveTabSelector, CartPanel } from '@widgets/OrderPanel';
import { ProductGrid } from '@widgets/OrderPanel/ProductGrid';
import { TabDrawer } from '@widgets/TabDrawer';

export default function POSPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <div className="flex h-full w-full max-w-[1600px] overflow-hidden rounded-xl border border-border shadow-lg">
        <main className="flex-1 overflow-y-auto p-4">
          <ProductGrid />
        </main>
        <aside id="order-panel" className="flex w-[400px] min-w-0 flex-col border-l bg-background">
          <ActiveTabSelector />
          <CartPanel />
        </aside>
        <TabDrawer />
      </div>
    </div>
  );
}
