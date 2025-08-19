import { useState, useCallback } from 'react';
import { useTableContext } from '../../contexts/NewTableContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Grid, Trash2, Edit2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '../../hooks/use-toast';

/**
 * @typedef {{ id?: string, name?: string, tables?: any[], created_by?: string }} SimpleLayout
 */

const NewTableLayouts = () => {
  const { user } = useAuth();
  const { 
    layouts, 
    loading, 
    saveLayout,
    activeLayoutId,
    deleteLayout,
    setActiveLayout,
  } = useTableContext();

  const { toast } = useToast();
  // Ensure TypeScript sees a concrete layout element type when mapping
  /** @type {SimpleLayout[]} */
  const typedLayouts = Array.isArray(layouts) ? /** @type {SimpleLayout[]} */ (layouts) : [];
  // Simple toast helper
  /** @type {(message: string, type?: 'success'|'error') => void} */
  const showToast = useCallback((message, type = 'success') => {
    toast({
      title: type === 'error' ? 'Error' : 'Success',
      description: message,
      variant: type === 'error' ? 'destructive' : undefined,
    });
  }, [toast]);

  // State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [editingLayout, setEditingLayout] = useState(/** @type {SimpleLayout | null} */(null));
  const [layoutToDelete, setLayoutToDelete] = useState(/** @type {SimpleLayout | null} */(null));
  const [activeTab, setActiveTab] = useState('grid');

  // Handlers with JSDoc types to satisfy checkJs
  /** @param {import('react').ChangeEvent<HTMLInputElement>} e */
  const handleNewLayoutNameChange = (e) => setNewLayoutName(e.target.value);

  /** @param {boolean} open */
  const handleEditDialogOpenChange = (open) => { if (!open) setEditingLayout(null); };

  /** @param {import('react').ChangeEvent<HTMLInputElement>} e */
  const handleEditLayoutNameChange = (e) => {
    setEditingLayout(editingLayout ? { ...editingLayout, name: e.target.value } : editingLayout);
  };

  // Handle create new layout
  const handleCreateLayout = async () => {
    if (!newLayoutName.trim()) {
      showToast('Please enter a name for the layout', 'error');
      return;
    }

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      await saveLayout({
        name: newLayoutName,
        created_by: user.id, // Ensure we're using the authenticated user's ID
        isActive: false,
        width: 1200,
        height: 800,
      });

      setNewLayoutName('');
      setIsCreateDialogOpen(false);
      
      showToast('Layout created successfully', 'success');
    } catch (error) {
      console.error('Error creating layout:', error);
      const msg = error instanceof Error ? error.message : 'Failed to create layout. Please try again.';
      showToast(msg, 'error');
    }
  };

  // Handle delete layout
  const handleDeleteLayout = async () => {
    if (!layoutToDelete || !layoutToDelete.id) {
      showToast('No layout selected to delete', 'error');
      return;
    }
    
    try {
      await deleteLayout(layoutToDelete.id);
      showToast('Layout deleted successfully', 'success');
      
      setIsDeleteDialogOpen(false);
      setLayoutToDelete(null);
    } catch (error) {
      console.error('Error deleting layout:', error);
      showToast('Failed to delete layout', 'error');
    }
  };

  // Handle set active layout
  /** @param {{ id?: string|number, name?: string }} layout */
  const handleSetActiveLayout = (layout) => {
    if (!layout || !layout.id) {
      showToast('Invalid layout selected', 'error');
      return;
    }
    // Call backend activation to keep server state consistent
    setActiveLayout(layout.id)
      .then(() => showToast(`${layout.name} is now active`, 'success'))
      .catch((/** @type {any} */ err) => {
        console.error('Error activating layout:', err);
        showToast('Failed to activate layout', 'error');
      });
  };

  // Layout card component
  /** @param {{layout: SimpleLayout}} props */
  const LayoutCard = ({ layout }) => (
    <Card className="relative group hover:shadow-md transition-shadow bg-white border border-gray-200">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-medium text-gray-900">
            {layout.name}
            {activeLayoutId === layout.id && (
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </CardTitle>
          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-600 hover:text-gray-900"
              onClick={() => setEditingLayout(layout)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:text-red-700"
              onClick={() => {
                setLayoutToDelete(layout);
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="aspect-video bg-gray-100 border border-gray-200 rounded-md flex items-center justify-center mb-4">
          <Grid className="h-12 w-12 text-gray-500" />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            {layout.tables?.length || 0} tables
          </span>
          <Button
            variant={activeLayoutId === layout.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSetActiveLayout(layout)}
            disabled={activeLayoutId === layout.id}
            className={activeLayoutId === layout.id ? 'bg-blue-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
          >
            {activeLayoutId === layout.id ? 'Active' : 'Set Active'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Layout list item component
  /** @param {{layout: SimpleLayout}} props */
  const LayoutListItem = ({ layout }) => (
    <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 transition-colors bg-white">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center">
          <Grid className="h-6 w-6 text-gray-500" />
        </div>
        <div>
          <h3 className="font-medium flex items-center text-gray-900">
            {layout.name}
            {activeLayoutId === layout.id && (
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-600">
            {layout.tables?.length || 0} tables • Created by {layout.created_by || 'system'}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-600 hover:text-gray-900"
          onClick={() => setEditingLayout(layout)}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            setLayoutToDelete(layout);
            setIsDeleteDialogOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          variant={activeLayoutId === layout.id ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSetActiveLayout(layout)}
          disabled={activeLayoutId === layout.id}
          className={activeLayoutId === layout.id ? 'bg-blue-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
        >
          {activeLayoutId === layout.id ? 'Active' : 'Set Active'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Table Layouts</h1>
          <p className="text-sm text-muted-foreground">
            Manage your table layouts and configurations
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Layout
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="grid">Grid View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (typedLayouts && typedLayouts.length > 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {typedLayouts.map((/** @type {SimpleLayout} */ layout) => (
                <LayoutCard key={layout.id} layout={layout} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Grid className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-1 text-gray-900">No layouts yet</h3>
              <p className="text-sm text-gray-600 mb-4">
                Get started by creating a new layout
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Layout
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <div className="space-y-4">
            {typedLayouts.map((/** @type {SimpleLayout} */ layout) => (
              <LayoutListItem key={layout.id} layout={layout} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Layout Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Layout</DialogTitle>
            <DialogDescription>
              Enter a name for your new table layout.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Input
                value={newLayoutName}
                onChange={handleNewLayoutNameChange}
                placeholder="Layout name"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLayout}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Layout</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this layout? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteLayout}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Layout Dialog */}
      <Dialog open={!!editingLayout} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Layout</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Input
                value={editingLayout?.name || ''}
                onChange={handleEditLayoutNameChange}
                placeholder="Layout name"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLayout(null)}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                try {
                  await saveLayout({
                    id: editingLayout?.id,
                    name: editingLayout?.name,
                  });
                  setEditingLayout(null);
                } catch (error) {
                  console.error('Error updating layout:', error);
                  showToast('Failed to update layout', 'error');
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewTableLayouts;
