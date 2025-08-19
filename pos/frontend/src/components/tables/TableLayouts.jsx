import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2, Copy, Eye, Check, X, LayoutGrid, LayoutList, Settings } from 'lucide-react';
import { useTableContext } from './TableContext';
import { useAuth } from '@/contexts/AuthContext';
import api from '../../services/api';

const TableLayouts = () => {
  const { 
    layouts = [], 
    layout: activeLayout, 
    setActiveLayoutId,
    saveLayout,
    loading,
    activeLayoutId,
  } = useTableContext();
  
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [layoutToDelete, setLayoutToDelete] = useState(null);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingLayoutId, setEditingLayoutId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const { user } = useAuth();

  // If no layouts exist, prompt creation
  useEffect(() => {
    if (!loading && Array.isArray(layouts) && layouts.length === 0) {
      setIsCreateDialogOpen(true);
    }
  }, [loading, layouts]);

  const handleCreateLayout = async () => {
    if (!newLayoutName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for the new layout.',
        status: 'error',
      });
      return;
    }

    // Ensure we have a valid user ID
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a layout.',
        status: 'error',
      });
      return;
    }

    try {
      const created = await saveLayout({
        name: newLayoutName,
        isActive: false,
        width: 1200,
        height: 800,
        created_by: user.id // Use snake_case for the backend
      });
      
      setNewLayoutName('');
      setIsCreateDialogOpen(false);
      
      toast({
        title: 'Layout created',
        description: `${newLayoutName} has been created.`,
        status: 'success',
      });

      // If no active layout yet, activate the newly created one
      try {
        const active = activeLayout;
        if (!active || !active.id) {
          const id = created?.id;
          if (id) {
            await api.put(`/table-layouts/${id}/activate`, {});
            setActiveLayoutId(id);
            toast({
              title: 'Layout activated',
              description: `${newLayoutName} is now active.`,
              status: 'success',
            });
          }
        }
      } catch (e) {
        console.error('Auto-activate new layout failed:', e);
      }
    } catch (error) {
      console.error('Error creating layout:', error);
      toast({
        title: 'Error',
        description: 'Failed to create layout. Please try again.',
        status: 'error',
      });
    }
  };

  const handleDeleteLayout = async () => {
    if (!layoutToDelete) return;
    
    try {
      // In a real app, you would call an API to delete the layout
      // await api.delete(`/table-layouts/${layoutToDelete.id}`);
      
      // For now, we'll just show a success message
      toast({
        title: 'Layout deleted',
        description: `${layoutToDelete.name} has been deleted.`,
        status: 'success',
      });
      
      // If the deleted layout was active, set another one as active
      if (activeLayout?.id === layoutToDelete.id) {
        const otherLayout = layouts.find(l => l.id !== layoutToDelete.id);
        if (otherLayout) {
          setActiveLayoutId(otherLayout.id);
        }
      }
      
      setIsDeleteDialogOpen(false);
      setLayoutToDelete(null);
    } catch (error) {
      console.error('Error deleting layout:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete layout. Please try again.',
        status: 'error',
      });
    }
  };

  const handleSetActiveLayout = async (layout) => {
    try {
      // Use backend activate endpoint to ensure exclusive activation
      await api.put(`/table-layouts/${layout.id}/activate`, {});
      setActiveLayoutId(layout.id);
      
      toast({
        title: 'Layout activated',
        description: `${layout.name} is now active.`,
        status: 'success',
      });
    } catch (error) {
      console.error('Error activating layout:', error);
      toast({
        title: 'Error',
        description: 'Failed to activate layout. Please try again.',
        status: 'error',
      });
    }
  };

  const handleStartEditing = (layout) => {
    setEditingLayoutId(layout.id);
    setEditingName(layout.name);
  };

  const handleCancelEditing = () => {
    setEditingLayoutId(null);
    setEditingName('');
  };

  const handleSaveEditing = async () => {
    if (!editingName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for the layout.',
        status: 'error',
      });
      return;
    }

    // Ensure we have a valid user ID
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to edit a layout.',
        status: 'error',
      });
      return;
    }

    try {
      await saveLayout({
        id: editingLayoutId,
        name: editingName,
        created_by: user.id // Use snake_case for the backend
      });
      
      setEditingLayoutId(null);
      setEditingName('');
      
      toast({
        title: 'Layout updated',
        description: 'Layout name has been updated.',
        status: 'success',
      });
    } catch (error) {
      console.error('Error updating layout:', error);
      toast({
        title: 'Error',
        description: 'Failed to update layout. Please try again.',
        status: 'error',
      });
    }
  };

  const handleDuplicateLayout = async (layout) => {
    try {
      // In a real app, you would call an API to duplicate the layout
      // const { data } = await api.post(`/table-layouts/${layout.id}/duplicate`);
      
      // For now, we'll just show a success message
      toast({
        title: 'Layout duplicated',
        description: `${layout.name} has been duplicated.`,
        status: 'success',
      });
    } catch (error) {
      console.error('Error duplicating layout:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate layout. Please try again.',
        status: 'error',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Table Layouts</h2>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            className="text-muted-foreground"
            onClick={() => {}}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={loading}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Layout
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="grid" className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="grid" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Grid View
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <LayoutList className="h-4 w-4" />
              List View
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="grid" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Add grid view content here */}
            <div className="border rounded-lg p-4 flex flex-col items-center justify-center h-40 cursor-pointer hover:bg-accent transition-colors"
                 onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-6 w-6 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">Add New Layout</span>
            </div>
            
            {layouts.map((layout) => (
              <div 
                key={layout.id}
                className={`border rounded-lg p-4 flex flex-col h-40 cursor-pointer transition-all ${
                  activeLayout?.id === layout.id 
                    ? 'ring-2 ring-primary' 
                    : 'hover:border-primary/50'
                }`}
              >
                <div className="flex-1 flex items-center justify-center bg-muted/30 rounded mb-3">
                  <LayoutGrid className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium truncate">{layout.name}</span>
                  {activeLayout?.id === layout.id && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="list" className="mt-0">

      <div className="border rounded-md divide-y">
        {layouts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No layouts found. Create your first layout to get started.
          </div>
        ) : (
          layouts.map((layout) => (
            <div 
              key={layout.id} 
              className={`p-3 flex items-center justify-between ${
                activeLayout?.id === layout.id ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                {editingLayoutId === layout.id ? (
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center">
                    {activeLayout?.id === layout.id && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 mr-2"></span>
                    )}
                    <span className="truncate font-medium">
                      {layout.name} {activeLayout?.id === layout.id && '(Active)'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-1">
                {editingLayoutId === layout.id ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSaveEditing(layout)}
                      className="h-8 w-8 p-0"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEditing}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    {activeLayout?.id !== layout.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetActiveLayout(layout)}
                        className="h-8 w-8 p-0"
                        title="Set as active"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEditing(layout)}
                      className="h-8 w-8 p-0"
                      title="Rename"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicateLayout(layout)}
                      className="h-8 w-8 p-0"
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLayoutToDelete(layout);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      disabled={layouts.length <= 1}
                      title={layouts.length <= 1 ? "Cannot delete the only layout" : "Delete"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      

        </TabsContent>
      </Tabs>
      
      {/* Create Layout Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Layout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="layoutName" className="text-sm font-medium">
                Layout Name
              </label>
              <Input
                id="layoutName"
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                placeholder="e.g., Main Floor, Patio, Private Room"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLayout} disabled={!newLayoutName.trim()}>
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
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the layout "{layoutToDelete?.name}"? 
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteLayout}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TableLayouts;
