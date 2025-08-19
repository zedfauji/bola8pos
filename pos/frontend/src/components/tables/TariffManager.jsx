import React, { useState, useEffect } from 'react';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Plus, Edit, Trash2, Search, X, Clock, DollarSign, Calendar, Users } from 'lucide-react';
import api from '../../services/api';

const TariffManager = () => {
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentTariff, setCurrentTariff] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const { toast } = useToast();

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rate: 0,
    rateType: 'hourly',
    isActive: true,
    minDuration: 0,
    maxDuration: 0,
    freeMinutes: 0,
    restrictions: {
      daysOfWeek: [],
      timeRanges: [],
      minPlayers: 1,
      maxPlayers: 10
    },
    tieredRates: []
  });

  // Fetch tariffs
  const fetchTariffs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tariffs', {
        params: {
          active: filterActive !== 'all' ? filterActive === 'active' : undefined,
          rateType: filterType !== 'all' ? filterType : undefined,
          search: searchTerm || undefined
        }
      });
      setTariffs(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching tariffs:', err);
      setError('Failed to load tariffs');
      toast({
        title: 'Error',
        description: 'Failed to load tariffs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTariffs();
  }, [filterActive, filterType, searchTerm]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      // Handle nested properties (e.g., restrictions.minPlayers)
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      // Handle top-level properties
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  // Handle select changes
  const handleSelectChange = (name, value) => {
    if (name.includes('.')) {
      // Handle nested properties
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      // Handle top-level properties
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Reset form data
  const resetFormData = () => {
    setFormData({
      name: '',
      description: '',
      rate: 0,
      rateType: 'hourly',
      isActive: true,
      minDuration: 0,
      maxDuration: 0,
      freeMinutes: 0,
      restrictions: {
        daysOfWeek: [],
        timeRanges: [],
        minPlayers: 1,
        maxPlayers: 10
      },
      tieredRates: []
    });
  };

  // Open create dialog
  const handleOpenCreateDialog = () => {
    resetFormData();
    setIsCreateDialogOpen(true);
  };

  // Open edit dialog
  const handleOpenEditDialog = (tariff) => {
    setCurrentTariff(tariff);
    setFormData({
      name: tariff.name,
      description: tariff.description || '',
      rate: tariff.rate,
      rateType: tariff.rateType,
      isActive: tariff.isActive,
      minDuration: tariff.minDuration || 0,
      maxDuration: tariff.maxDuration || 0,
      freeMinutes: tariff.freeMinutes || 0,
      restrictions: {
        daysOfWeek: tariff.restrictions?.daysOfWeek || [],
        timeRanges: tariff.restrictions?.timeRanges || [],
        minPlayers: tariff.restrictions?.minPlayers || 1,
        maxPlayers: tariff.restrictions?.maxPlayers || 10
      },
      tieredRates: tariff.tieredRates || []
    });
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const handleOpenDeleteDialog = (tariff) => {
    setCurrentTariff(tariff);
    setIsDeleteDialogOpen(true);
  };

  // Create tariff
  const handleCreateTariff = async () => {
    try {
      await api.post('/tariffs', formData);
      setIsCreateDialogOpen(false);
      fetchTariffs();
      toast({
        title: 'Success',
        description: 'Tariff created successfully',
      });
    } catch (err) {
      console.error('Error creating tariff:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to create tariff',
        variant: 'destructive',
      });
    }
  };

  // Update tariff
  const handleUpdateTariff = async () => {
    if (!currentTariff) return;
    
    try {
      await api.put(`/tariffs/${currentTariff.id}`, formData);
      setIsEditDialogOpen(false);
      fetchTariffs();
      toast({
        title: 'Success',
        description: 'Tariff updated successfully',
      });
    } catch (err) {
      console.error('Error updating tariff:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update tariff',
        variant: 'destructive',
      });
    }
  };

  // Delete tariff
  const handleDeleteTariff = async () => {
    if (!currentTariff) return;
    
    try {
      await api.delete(`/tariffs/${currentTariff.id}`);
      setIsDeleteDialogOpen(false);
      fetchTariffs();
      toast({
        title: 'Success',
        description: 'Tariff deleted successfully',
      });
    } catch (err) {
      console.error('Error deleting tariff:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to delete tariff',
        variant: 'destructive',
      });
    }
  };

  // Toggle tariff active status
  const handleToggleActive = async (tariff) => {
    try {
      await api.put(`/tariffs/${tariff.id}`, {
        ...tariff,
        isActive: !tariff.isActive
      });
      fetchTariffs();
      toast({
        title: 'Success',
        description: `Tariff ${tariff.isActive ? 'deactivated' : 'activated'} successfully`,
      });
    } catch (err) {
      console.error('Error toggling tariff status:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update tariff status',
        variant: 'destructive',
      });
    }
  };

  // Get rate type badge
  const getRateTypeBadge = (rateType) => {
    const typeMap = {
      'hourly': { color: 'bg-blue-100 text-blue-800', icon: <Clock className="h-3 w-3 mr-1" /> },
      'fixed': { color: 'bg-green-100 text-green-800', icon: <DollarSign className="h-3 w-3 mr-1" /> },
      'session': { color: 'bg-purple-100 text-purple-800', icon: <Calendar className="h-3 w-3 mr-1" /> }
    };
    
    const typeInfo = typeMap[rateType] || { color: 'bg-gray-100 text-gray-800', icon: null };
    
    return (
      <Badge className={`${typeInfo.color} font-medium flex items-center`}>
        {typeInfo.icon}
        {rateType.charAt(0).toUpperCase() + rateType.slice(1)}
      </Badge>
    );
  };

  // Filter tariffs
  const filteredTariffs = tariffs.filter(tariff => {
    const matchesSearch = searchTerm === '' || 
      tariff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tariff.description && tariff.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesActive = filterActive === 'all' || 
      (filterActive === 'active' && tariff.isActive) || 
      (filterActive === 'inactive' && !tariff.isActive);
    
    const matchesType = filterType === 'all' || tariff.rateType === filterType;
    
    return matchesSearch && matchesActive && matchesType;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tariff Management</h2>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Tariff
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tariffs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2.5"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="session">Session</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tariffs Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-red-500">
          <p>{error}</p>
          <Button onClick={fetchTariffs} variant="outline" size="sm" className="mt-2">
            Retry
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tariffs ({filteredTariffs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Restrictions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTariffs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No tariffs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTariffs.map((tariff) => (
                    <TableRow key={tariff.id}>
                      <TableCell className="font-medium">
                        {tariff.name}
                        {tariff.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {tariff.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{getRateTypeBadge(tariff.rateType)}</TableCell>
                      <TableCell>
                        ${tariff.rate.toFixed(2)}
                        {tariff.rateType === 'hourly' && <span className="text-xs text-muted-foreground">/hr</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tariff.isActive ? "default" : "outline"}>
                          {tariff.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tariff.restrictions && (
                          <div className="flex flex-wrap gap-1">
                            {tariff.restrictions.minPlayers > 1 && (
                              <Badge variant="outline" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                Min: {tariff.restrictions.minPlayers}
                              </Badge>
                            )}
                            {tariff.restrictions.maxPlayers < 10 && (
                              <Badge variant="outline" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                Max: {tariff.restrictions.maxPlayers}
                              </Badge>
                            )}
                            {tariff.restrictions.daysOfWeek?.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Calendar className="h-3 w-3 mr-1" />
                                Days: {tariff.restrictions.daysOfWeek.length}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(tariff)}
                            title={tariff.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {tariff.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditDialog(tariff)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => handleOpenDeleteDialog(tariff)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isCreateDialogOpen ? 'Create New Tariff' : 'Edit Tariff'}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
              <TabsTrigger value="tiered">Tiered Rates</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Standard Rate, Weekend Special"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rateType">Rate Type</Label>
                  <Select
                    value={formData.rateType}
                    onValueChange={(value) => handleSelectChange('rateType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="session">Session</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rate">Rate ($)</Label>
                  <Input
                    id="rate"
                    name="rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.rate}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="freeMinutes">Free Minutes</Label>
                  <Input
                    id="freeMinutes"
                    name="freeMinutes"
                    type="number"
                    min="0"
                    value={formData.freeMinutes}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Optional description"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="minDuration">Min Duration (minutes)</Label>
                  <Input
                    id="minDuration"
                    name="minDuration"
                    type="number"
                    min="0"
                    value={formData.minDuration}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxDuration">Max Duration (minutes)</Label>
                  <Input
                    id="maxDuration"
                    name="maxDuration"
                    type="number"
                    min="0"
                    value={formData.maxDuration}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="col-span-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isActive"
                      name="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          isActive: checked
                        }));
                      }}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="restrictions" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minPlayers">Minimum Players</Label>
                  <Input
                    id="minPlayers"
                    name="restrictions.minPlayers"
                    type="number"
                    min="1"
                    value={formData.restrictions.minPlayers}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxPlayers">Maximum Players</Label>
                  <Input
                    id="maxPlayers"
                    name="restrictions.maxPlayers"
                    type="number"
                    min="1"
                    value={formData.restrictions.maxPlayers}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="col-span-2">
                  <Label className="block mb-2">Days of Week</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                      <div key={day} className="flex flex-col items-center">
                        <Checkbox
                          id={`day-${index}`}
                          checked={formData.restrictions.daysOfWeek.includes(index)}
                          onCheckedChange={(checked) => {
                            const newDays = [...formData.restrictions.daysOfWeek];
                            if (checked) {
                              if (!newDays.includes(index)) {
                                newDays.push(index);
                              }
                            } else {
                              const dayIndex = newDays.indexOf(index);
                              if (dayIndex !== -1) {
                                newDays.splice(dayIndex, 1);
                              }
                            }
                            setFormData(prev => ({
                              ...prev,
                              restrictions: {
                                ...prev.restrictions,
                                daysOfWeek: newDays
                              }
                            }));
                          }}
                        />
                        <Label htmlFor={`day-${index}`} className="mt-1 text-xs">
                          {day}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Time ranges would go here - simplified for now */}
                <div className="col-span-2">
                  <Label className="block mb-2">Time Ranges</Label>
                  <p className="text-sm text-muted-foreground">
                    Time range restrictions are configured in the advanced settings.
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="tiered" className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Tiered rates allow you to charge different amounts based on duration or player count.
              </p>
              
              {formData.tieredRates.length === 0 ? (
                <div className="text-center py-8 border rounded-md">
                  <p className="text-muted-foreground">No tiered rates configured</p>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tier
                  </Button>
                </div>
              ) : (
                <div>
                  {/* Tiered rates would go here */}
                  <p>Tiered rates implementation coming soon...</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setIsEditDialogOpen(false);
            }}>
              Cancel
            </Button>
            <Button onClick={isCreateDialogOpen ? handleCreateTariff : handleUpdateTariff}>
              {isCreateDialogOpen ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tariff</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the tariff "{currentTariff?.name}"? 
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteTariff}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TariffManager;
