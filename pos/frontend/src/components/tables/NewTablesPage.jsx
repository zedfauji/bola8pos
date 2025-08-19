import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { LayoutGrid, Settings, Plus, List } from 'lucide-react';
import TableLayoutEditor from './TableLayoutEditor';
import TableLayouts from './TableLayouts';
import { useTableContext } from '../../contexts/TableContext';

const NewTablesPage = () => {
  const { layout, loading, error } = useTableContext();
  const [activeTab, setActiveTab] = useState('layout');
  const [showLayouts, setShowLayouts] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error loading table data: {error.message}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${showLayouts ? 'w-64' : 'w-16'} bg-white border-r transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b flex items-center justify-between">
          {showLayouts ? (
            <h2 className="font-semibold">Table Layouts</h2>
          ) : (
            <div className="w-6"></div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLayouts(!showLayouts)}
            className="h-8 w-8 p-0"
          >
            {showLayouts ? <List className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {showLayouts && <TableLayouts />}
        </div>
        
        <div className="p-2 border-t">
          <Button 
            className="w-full" 
            size="sm"
            onClick={() => {
              // Handle new layout creation
              setShowLayouts(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {showLayouts && 'New Layout'}
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Table Management</h1>
            
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="w-auto"
            >
              <TabsList>
                <TabsTrigger value="layout">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Layout
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List className="h-4 w-4 mr-2" />
                  List View
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </header>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full">
            {activeTab === 'layout' && <TableLayoutEditor />}
            {activeTab === 'list' && (
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Tables List</h2>
                <p className="text-muted-foreground">Table list view coming soon...</p>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Table Settings</h2>
                <p className="text-muted-foreground">Table settings coming soon...</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default NewTablesPage;
