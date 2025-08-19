import React, { useState, useEffect } from 'react';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Plus, Edit, Trash2, Check, Grid, Image, LayoutGrid } from 'lucide-react';
import { useTableContext } from '../../contexts/NewTableContext';
import { useAuth } from '../../contexts/AuthContext';

const TableLayoutSelector = () => {
  const { layouts, activeLayout, setActiveLayout, createLayout, updateLayout, deleteLayout } = useTableContext();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [layoutName, setLayoutName] = useState('');
  const [layoutDescription, setLayoutDescription] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if user has admin or manager role
  const hasEditPermission = user && (user.role === 'admin' || user.role === 'manager');

  // Open create dialog
  const handleOpenCreateDialog = () => {
    setLayoutName('');
    setLayoutDescription('');
    setIsCreateDialogOpen(true);
  };

  // Open edit dialog
  const handleOpenEditDialog = (layout) => {
    setSelectedLayout(layout);
    setLayoutName(layout.name);
    setLayoutDescription(layout.description || '');
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const handleOpenDeleteDialog = (layout) => {
    setSelectedLayout(layout);
    setIsDeleteDialogOpen(true);
  };

  // Create layout
  const handleCreateLayout = async () => {
    if (!layoutName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for the layout',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createLayout({
        name: layoutName,
        description: layoutDescription,
      });
      setIsCreateDialogOpen(false);
      toast({
        title: 'Layout Created',
        description: `Layout "${layoutName}" has been created successfully`,
      });
    } catch (err) {
      console.error('Error creating layout:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to create layout',
        variant: 'destructive',
      });
    }
  };

  // Update layout
  const handleUpdateLayout = async () => {
    if (!selectedLayout) return;
    
    if (!layoutName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for the layout',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateLayout({
        ...selectedLayout,
        name: layoutName,
        description: layoutDescription,
      });
      setIsEditDialogOpen(false);
      toast({
        title: 'Layout Updated',
        description: `Layout "${layoutName}" has been updated successfully`,
      });
    } catch (err) {
      console.error('Error updating layout:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update layout',
        variant: 'destructive',
      });
    }
  };

  // Delete layout
  const handleDeleteLayout = async () => {
    if (!selectedLayout) return;

    try {
      await deleteLayout(selectedLayout.id);
      setIsDeleteDialogOpen(false);
      toast({
        title: 'Layout Deleted',
        description: `Layout "${selectedLayout.name}" has been deleted successfully`,
      });
    } catch (err) {
      console.error('Error deleting layout:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to delete layout',
        variant: 'destructive',
      });
    }
  };

  // Set active layout
  const handleSetActiveLayout = async (layout) => {
    try {
      await setActiveLayout(layout.id);
      toast({
        title: 'Layout Activated',
        description: `Layout "${layout.name}" is now active`,
      });
    } catch (err) {
      console.error('Error setting active layout:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to set active layout',
        variant: 'destructive',
      });
    }
  };

  // Get layout card class based on active status
  const getLayoutCardClass = (layout) => {
    return layout.id === activeLayout?.id
      ? 'border-primary bg-primary/5'
      : 'border-border hover:border-primary/50';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Table Layouts</h2>
        {hasEditPermission && (
          <Button onClick={handleOpenCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Layout
          </Button>
        )}
      </div>

      {layouts.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center justify-center">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Layouts Found</h3>
            <p className="text-muted-foreground mt-2 mb-4">
              Create your first table layout to get started
            </p>
            {hasEditPermission && (
              <Button onClick={handleOpenCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create Layout
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {layouts.map((layout) => (
            <Card 
              key={layout.id} 
              className={`transition-all duration-200 ${getLayoutCardClass(layout)}`}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{layout.name}</CardTitle>
                  {layout.id === activeLayout?.id && (
                    <Badge className="bg-primary">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                {layout.description && (
                  <p className="text-sm text-muted-foreground">
                    {layout.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center">
                    <Grid className="h-4 w-4 mr-1 text-muted-foreground" />
                    <span>{layout.tableCount || 0} Tables</span>
                  </div>
                  {layout.floorPlanUrl && (
                    <div className="flex items-center">
                      <Image className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span>Has Floor Plan</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                {layout.id !== activeLayout?.id ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleSetActiveLayout(layout)}
                  >
                    Set Active
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled
                  >
                    Current Layout
                  </Button>
                )}
                
                {hasEditPermission && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEditDialog(layout)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleOpenDeleteDialog(layout)}
                      disabled={layouts.length === 1} // Prevent deleting the last layout
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Layout Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Layout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Layout Name
              </label>
              <Input
                id="name"
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                placeholder="e.g., Main Floor, Tournament Layout"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (Optional)
              </label>
              <Input
                id="description"
                value={layoutDescription}
                onChange={(e) => setLayoutDescription(e.target.value)}
                placeholder="Brief description of this layout"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLayout}>
              Create Layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Layout Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Layout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="edit-name" className="text-sm font-medium">
                Layout Name
              </label>
              <Input
                id="edit-name"
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-description" className="text-sm font-medium">
                Description (Optional)
              </label>
              <Input
                id="edit-description"
                value={layoutDescription}
                onChange={(e) => setLayoutDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateLayout}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Layout Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Layout</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the layout "{selectedLayout?.name}"? 
              This will permanently remove all tables associated with this layout.
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
            >
              Delete Layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TableLayoutSelector;
