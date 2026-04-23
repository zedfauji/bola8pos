import { CategoryTreeEditor } from '@features/manage-categories';
import { ModifierGroupEditor } from '@features/manage-modifier-groups';
import { CatalogModifiersTab, CatalogProductsTab } from '@features/manage-products';
import type { UserRole } from '@shared/lib/domain';
import { ProtectedAction } from '@shared/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';

type Props = {
  currentRole: UserRole | null;
};

export function ProductsSettingsTab({ currentRole }: Props) {
  return (
    <ProtectedAction action="manage_products" currentRole={currentRole}>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Product Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage products, categories, modifiers, and modifier groups. Changes are applied
            immediately after save.
          </p>
        </div>
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="modifiers">Modifiers</TabsTrigger>
            <TabsTrigger value="modifier-groups">Modifier Groups</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <CatalogProductsTab />
          </TabsContent>
          <TabsContent value="categories">
            {/* Category tree editor: supports 3-level hierarchy (S1-08) */}
            <CategoryTreeEditor />
          </TabsContent>
          <TabsContent value="modifiers">
            <CatalogModifiersTab />
          </TabsContent>
          <TabsContent value="modifier-groups">
            {/* Modifier group editor: admin CRUD + modifier attachment (S1-09) */}
            <ModifierGroupEditor />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedAction>
  );
}
