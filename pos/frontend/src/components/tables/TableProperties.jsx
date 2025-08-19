import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Clock, Users, Tag, MapPin, RotateCw, RotateCcw, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '../../hooks/use-toast';

const TableProperties = ({ table, onUpdate, onClose, onDelete }) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: table.name || '',
    status: table.status || 'available',
    group: table.group || '',
    capacity: table.capacity || 4,
    positionX: table.positionX || 0,
    positionY: table.positionY || 0,
    width: table.width || 100,
    height: table.height || 60,
    rotation: table.rotation || 0,
    notes: table.notes || '',
  });
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (table) {
      setFormData({
        name: table.name || '',
        status: table.status || 'available',
        group: table.group || '',
        capacity: table.capacity || 4,
        positionX: table.positionX || 0,
        positionY: table.positionY || 0,
        width: table.width || 100,
        height: table.height || 60,
        rotation: table.rotation || 0,
        notes: table.notes || '',
      });
    }
  }, [table]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumericChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: Number(value)
    }));
  };

  const handleSave = () => {
    try {
      onUpdate(table.id, formData);
      setIsEditing(false);
      
      toast({
        title: 'Table updated',
        description: 'The table properties have been saved.',
        status: 'success',
      });
    } catch (error) {
      console.error('Error updating table:', error);
      toast({
        title: 'Error',
        description: 'Failed to update table. Please try again.',
        status: 'error',
      });
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this table?')) {
      onDelete(table.id);
      onClose();
    }
  };

  const statusOptions = [
    { value: 'available', label: 'Available', color: 'bg-green-500' },
    { value: 'occupied', label: 'Occupied', color: 'bg-blue-500' },
    { value: 'reserved', label: 'Reserved', color: 'bg-yellow-500' },
    { value: 'cleaning', label: 'Cleaning', color: 'bg-purple-500' },
    { value: 'maintenance', label: 'Maintenance', color: 'bg-red-500' },
  ];

  const getStatusColor = (status) => {
    const statusOption = statusOptions.find(opt => opt.value === status);
    return statusOption ? statusOption.color : 'bg-gray-500';
  };

  if (!table) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-lg border-l z-50 flex flex-col text-gray-900">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-lg">Table Properties</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="details" className="flex-1">
            <Tag className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="position" className="flex-1">
            <MapPin className="h-4 w-4 mr-2" />
            Position
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="details" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Table Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleSelectChange('status', value)}
                disabled={!isEditing}
              >
                <SelectTrigger>
                  <div className="flex items-center">
                    <div className={`h-2 w-2 rounded-full ${getStatusColor(formData.status)} mr-2`} />
                    <SelectValue placeholder="Select status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center">
                        <div className={`h-2 w-2 rounded-full ${option.color} mr-2`} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              <Input
                id="group"
                name="group"
                value={formData.group}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="e.g., Main Hall, Patio"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="capacity">Capacity: {formData.capacity}</Label>
                <span className="text-sm text-muted-foreground">
                  {formData.capacity} {formData.capacity === 1 ? 'person' : 'people'}
                </span>
              </div>
              <Slider
                id="capacity"
                min={1}
                max={12}
                step={1}
                value={[formData.capacity]}
                onValueChange={([value]) => handleNumericChange('capacity', value)}
                disabled={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                disabled={!isEditing}
                className="flex h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Any special notes about this table..."
              />
            </div>
          </TabsContent>

          <TabsContent value="position" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="positionX">X Position</Label>
                <Input
                  id="positionX"
                  type="number"
                  value={formData.positionX}
                  onChange={(e) => handleNumericChange('positionX', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="positionY">Y Position</Label>
                <Input
                  id="positionY"
                  type="number"
                  value={formData.positionY}
                  onChange={(e) => handleNumericChange('positionY', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="rotation">Rotation: {formData.rotation}°</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNumericChange('rotation', (formData.rotation - 15) % 360)}
                  disabled={!isEditing}
                  className="h-8 w-8 p-0"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Slider
                  id="rotation"
                  min={0}
                  max={360}
                  step={15}
                  value={[formData.rotation]}
                  onValueChange={([value]) => handleNumericChange('rotation', value)}
                  disabled={!isEditing}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNumericChange('rotation', (formData.rotation + 15) % 360)}
                  disabled={!isEditing}
                  className="h-8 w-8 p-0"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width">Width</Label>
                <Input
                  id="width"
                  type="number"
                  value={formData.width}
                  onChange={(e) => handleNumericChange('width', e.target.value)}
                  disabled={!isEditing}
                  min={60}
                  max={300}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height</Label>
                <Input
                  id="height"
                  type="number"
                  value={formData.height}
                  onChange={(e) => handleNumericChange('height', e.target.value)}
                  disabled={!isEditing}
                  min={40}
                  max={200}
                />
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="p-4 border-t flex justify-between">
        <div className="space-x-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  // Reset form data to original values
                  setFormData({
                    name: table.name || '',
                    status: table.status || 'available',
                    group: table.group || '',
                    capacity: table.capacity || 4,
                    positionX: table.positionX || 0,
                    positionY: table.positionY || 0,
                    width: table.width || 100,
                    height: table.height || 60,
                    rotation: table.rotation || 0,
                    notes: table.notes || '',
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Edit Table
            </Button>
          )}
        </div>
        
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          className="text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>
    </div>
  );
};

export default TableProperties;
