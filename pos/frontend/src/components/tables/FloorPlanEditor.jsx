import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Label } from '../../components/ui/label';
import { Slider } from '../../components/ui/slider';
import { Upload, Image, Save, Trash2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useTableContext } from '../../contexts/NewTableContext';
import api from '../../services/api';

const FloorPlanEditor = () => {
  const { activeLayout, saveLayout } = useTableContext();
  const [floorPlanImage, setFloorPlanImage] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Load floor plan image when layout changes
  useEffect(() => {
    if (activeLayout?.floorPlanUrl) {
      setFloorPlanImage(activeLayout.floorPlanUrl);
    } else {
      setFloorPlanImage(null);
    }
  }, [activeLayout]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a JPEG, PNG, GIF, or WebP image',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    // Create a preview URL
    const imageUrl = URL.createObjectURL(file);
    setUploadedImage(imageUrl);
    setFloorPlanImage(imageUrl);
    
    // Reset transformations
    setZoom(100);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
  };

  // Handle upload button click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handle save floor plan
  const handleSaveFloorPlan = async () => {
    if (!activeLayout) {
      toast({
        title: 'No active layout',
        description: 'Please select or create a layout first',
        variant: 'destructive',
      });
      return;
    }

    if (!uploadedImage) {
      toast({
        title: 'No changes to save',
        description: 'Please upload a new floor plan image first',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Create a form data object
      const formData = new FormData();
      
      // Convert data URL to Blob if needed
      const response = await fetch(uploadedImage);
      const blob = await response.blob();
      
      // Add the file to form data
      formData.append('floorPlan', blob, 'floor-plan.jpg');
      
      // Add transformation parameters
      formData.append('zoom', zoom);
      formData.append('rotation', rotation);
      formData.append('brightness', brightness);
      formData.append('contrast', contrast);
      
      // Upload the floor plan
      await api.post(`/table-layouts/${activeLayout.id}/floor-plan`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Update the layout in context
      await saveLayout({
        ...activeLayout,
        floorPlanUrl: `${activeLayout.floorPlanUrl}?t=${Date.now()}` // Force refresh
      });
      
      toast({
        title: 'Floor plan saved',
        description: 'The floor plan has been updated successfully',
      });
      
      // Clear the uploaded image state since it's now saved
      setUploadedImage(null);
    } catch (err) {
      console.error('Error saving floor plan:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to save floor plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete floor plan
  const handleDeleteFloorPlan = async () => {
    if (!activeLayout) return;
    
    if (!activeLayout.floorPlanUrl) {
      toast({
        title: 'No floor plan',
        description: 'There is no floor plan to delete',
      });
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete the floor plan?')) {
      return;
    }
    
    try {
      await api.delete(`/table-layouts/${activeLayout.id}/floor-plan`);
      
      // Update the layout in context
      await saveLayout({
        ...activeLayout,
        floorPlanUrl: null
      });
      
      setFloorPlanImage(null);
      setUploadedImage(null);
      
      toast({
        title: 'Floor plan deleted',
        description: 'The floor plan has been deleted successfully',
      });
    } catch (err) {
      console.error('Error deleting floor plan:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to delete floor plan',
        variant: 'destructive',
      });
    }
  };

  // Reset transformations
  const handleResetTransformations = () => {
    setZoom(100);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Floor Plan Editor</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Image
          </Button>
          <Button
            onClick={handleSaveFloorPlan}
            disabled={isSaving || !uploadedImage}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Floor Plan Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Floor Plan Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center bg-gray-50 min-h-[400px]">
            {floorPlanImage ? (
              <div className="relative max-w-full max-h-[400px] overflow-hidden">
                <img
                  src={floorPlanImage}
                  alt="Floor Plan"
                  className="max-w-full max-h-[400px] object-contain"
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                    transition: 'transform 0.2s, filter 0.2s',
                  }}
                />
              </div>
            ) : (
              <div className="text-center p-8">
                <Image className="h-16 w-16 mx-auto text-gray-400" />
                <p className="mt-4 text-muted-foreground">
                  No floor plan image uploaded
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleUploadClick}
                >
                  Upload Image
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                disabled={!floorPlanImage}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                disabled={!floorPlanImage}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setRotation((rotation + 90) % 360)}
                disabled={!floorPlanImage}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
            {floorPlanImage && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteFloorPlan}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Floor Plan
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Image Adjustments */}
        <Card>
          <CardHeader>
            <CardTitle>Image Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="zoom">Zoom ({zoom}%)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setZoom(100)}
                  disabled={zoom === 100}
                >
                  Reset
                </Button>
              </div>
              <Slider
                id="zoom"
                min={50}
                max={200}
                step={1}
                value={[zoom]}
                onValueChange={(value) => setZoom(value[0])}
                disabled={!floorPlanImage}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="rotation">Rotation ({rotation}°)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setRotation(0)}
                  disabled={rotation === 0}
                >
                  Reset
                </Button>
              </div>
              <Slider
                id="rotation"
                min={0}
                max={359}
                step={1}
                value={[rotation]}
                onValueChange={(value) => setRotation(value[0])}
                disabled={!floorPlanImage}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="brightness">Brightness ({brightness}%)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setBrightness(100)}
                  disabled={brightness === 100}
                >
                  Reset
                </Button>
              </div>
              <Slider
                id="brightness"
                min={50}
                max={150}
                step={1}
                value={[brightness]}
                onValueChange={(value) => setBrightness(value[0])}
                disabled={!floorPlanImage}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="contrast">Contrast ({contrast}%)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setContrast(100)}
                  disabled={contrast === 100}
                >
                  Reset
                </Button>
              </div>
              <Slider
                id="contrast"
                min={50}
                max={150}
                step={1}
                value={[contrast]}
                onValueChange={(value) => setContrast(value[0])}
                disabled={!floorPlanImage}
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleResetTransformations}
              disabled={!floorPlanImage || (zoom === 100 && rotation === 0 && brightness === 100 && contrast === 100)}
            >
              Reset All Adjustments
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FloorPlanEditor;
