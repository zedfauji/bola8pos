import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { TableLayoutEditor } from '../components/tables/TableLayoutEditor';
import TableLayoutSelector from '../components/tables/TableLayoutSelector';
import TariffManager from '../components/tables/TariffManager';
import FloorPlanEditor from '../components/tables/FloorPlanEditor';
import SessionManager from '../components/tables/SessionManager';
import { useTableContext } from '../contexts/NewTableContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { withRoleGuard } from '../hoc/withRoleGuard';
import { Layout, LayoutGrid, Grid3X3, Settings, Clock, DollarSign, Image } from 'lucide-react';

const TableManagementPage = () => {
  const [activeTab, setActiveTab] = useState('layouts');
  const [selectedTable, setSelectedTable] = useState(null);
  const { activeLayout, tables, fetchTables, updateTableInList } = useTableContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const { connected, subscribe, joinRoom, leaveRoom } = useSocket();

  // Check if user has admin or manager role for advanced features
  const hasAdvancedAccess = user && (user.role === 'admin' || user.role === 'manager');

  // Get socket from context
  const { socket } = useSocket();
  
  // Handle real-time table updates
  const handleTableUpdate = useCallback((/** @type {any} */ updatedTable) => {
    console.log('Received table update:', updatedTable);
    updateTableInList(updatedTable);
  }, [updateTableInList]);

  // Socket.io integration for real-time updates
  useEffect(() => {
    if (socket && activeLayout) {
      // Join room for the active layout
      joinRoom(`layout_${activeLayout.id}`);
      
      // Handler for table updates
      const handleSocketTableUpdate = (/** @type {any} */ updatedTable) => {
        console.log('Table updated via socket:', updatedTable);
        updateTableInList(updatedTable);
        toast({
          title: 'Table Updated',
          description: `Table ${updatedTable.name} has been updated`,
        });
      };
      
      // Handler for session updates
      const handleSocketSessionUpdate = (/** @type {any} */ sessionData) => {
        console.log('Session updated via socket:', sessionData);
        // Update the table with the new session data
        if (sessionData.tableId) {
          const tableToUpdate = tables.find(t => t.id === sessionData.tableId);
          if (tableToUpdate) {
            const updatedTable = {
              ...tableToUpdate,
              currentSession: sessionData,
              status: sessionData.status === 'active' ? 'occupied' : 
                     sessionData.status === 'paused' ? 'reserved' : 'available'
            };
            updateTableInList(updatedTable);
          }
        }
        
        toast({
          title: 'Session Updated',
          description: `Session on table ${sessionData.tableName || 'unknown'} is now ${sessionData.status}`,
        });
      };
      
      // Subscribe to events
      subscribe('table_updated', handleSocketTableUpdate);
      subscribe('session_updated', handleSocketSessionUpdate);
      
      return () => {
        leaveRoom(`layout_${activeLayout.id}`);
        // Unsubscribe handled by the socket context
      };
    }
  }, [socket, activeLayout, updateTableInList, tables, toast, subscribe, joinRoom, leaveRoom]);

  // Fetch tables when active layout changes and subscribe to socket events
  useEffect(() => {
    if (activeLayout) {
      fetchTables(activeLayout.id);
      
      // Join the layout room for real-time updates
      if (connected) {
        const layoutRoom = `layout:${activeLayout.id}`;
        joinRoom(layoutRoom);
        
        // Return cleanup function
        return () => {
          leaveRoom(layoutRoom);
        };
      }
    }
  }, [activeLayout, connected, joinRoom, leaveRoom, fetchTables]);
  
  // Subscribe to table and session updates
  useEffect(() => {
    if (!connected) return;
    
    // Subscribe to table updates
    const unsubscribeTableUpdate = subscribe('table:update', handleTableUpdate);
    
    // Subscribe to session updates
    const unsubscribeSessionUpdate = subscribe('session:update', handleSessionUpdate);
    
    // Cleanup subscriptions
    return () => {
      unsubscribeTableUpdate();
      unsubscribeSessionUpdate();
    };
  }, [connected, subscribe, handleTableUpdate, handleSessionUpdate]);

  // Handle table selection
  const handleTableSelect = (table) => {
    setSelectedTable(table);
    // Switch to session tab when a table is selected
    setActiveTab('session');
  };

  // Handle manual session update from SessionManager component
  const handleManualSessionUpdate = () => {
    // Refresh tables to get updated status
    if (activeLayout) {
      fetchTables(activeLayout.id);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Table Management</h1>
          <p className="text-muted-foreground">
            Manage tables, layouts, sessions, and tariffs
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full">
          <TabsTrigger value="layouts" className="flex items-center">
            <LayoutGrid className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Layouts</span>
            <span className="md:hidden">Layouts</span>
          </TabsTrigger>
          <TabsTrigger value="editor" className="flex items-center">
            <Layout className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Layout Editor</span>
            <span className="md:hidden">Editor</span>
          </TabsTrigger>
          <TabsTrigger value="tables" className="flex items-center">
            <Grid3X3 className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Table List</span>
            <span className="md:hidden">Tables</span>
          </TabsTrigger>
          <TabsTrigger value="session" className="flex items-center" disabled={!selectedTable}>
            <Clock className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Session</span>
            <span className="md:hidden">Session</span>
          </TabsTrigger>
          {hasAdvancedAccess && (
            <>
              <TabsTrigger value="tariffs" className="flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">Tariffs</span>
                <span className="md:hidden">Tariffs</span>
              </TabsTrigger>
              <TabsTrigger value="floorplan" className="flex items-center">
                <Image className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">Floor Plan</span>
                <span className="md:hidden">Plan</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Layouts Tab */}
        <TabsContent value="layouts" className="space-y-4">
          <TableLayoutSelector />
        </TabsContent>

        {/* Layout Editor Tab */}
        <TabsContent value="editor" className="space-y-4">
          {activeLayout ? (
            <TableLayoutEditor />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <Layout className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Active Layout</h3>
                <p className="text-muted-foreground mt-2 mb-4 text-center">
                  Please select or create a layout first
                </p>
                <Button onClick={() => setActiveTab('layouts')}>
                  Go to Layouts
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tables Tab */}
        <TabsContent value="tables" className="space-y-4">
          {activeLayout ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Tables in {activeLayout.name}</h2>
              </div>
              
              {tables.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-8">
                    <Grid3X3 className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Tables Found</h3>
                    <p className="text-muted-foreground mt-2 mb-4 text-center">
                      Create tables in the Layout Editor
                    </p>
                    <Button onClick={() => setActiveTab('editor')}>
                      Go to Layout Editor
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tables.map((table) => (
                    <Card 
                      key={table.id}
                      className={`cursor-pointer transition-all hover:border-primary ${
                        selectedTable?.id === table.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => handleTableSelect(table)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium">{table.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {table.type || 'Standard'} • Capacity: {table.capacity || 'N/A'}
                            </p>
                          </div>
                          <div className={`w-3 h-3 rounded-full ${
                            table.status === 'occupied' ? 'bg-red-500' :
                            table.status === 'reserved' ? 'bg-yellow-500' :
                            table.status === 'maintenance' ? 'bg-purple-500' :
                            'bg-green-500'
                          }`} />
                        </div>
                        {table.status !== 'available' && (
                          <div className="mt-2 text-xs">
                            <span className="font-medium">Status: </span>
                            <span className="capitalize">{table.status}</span>
                            {table.currentSession && (
                              <p className="mt-1">
                                Session started: {new Date(table.currentSession.startTime).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <Grid3X3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Active Layout</h3>
                <p className="text-muted-foreground mt-2 mb-4 text-center">
                  Please select or create a layout first
                </p>
                <Button onClick={() => setActiveTab('layouts')}>
                  Go to Layouts
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Session Tab */}
        <TabsContent value="session" className="space-y-4">
          {selectedTable ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Table: {selectedTable.name}</h2>
                  <p className="text-muted-foreground">
                    Manage sessions and status for this table
                  </p>
                </div>
                <Button variant="outline" onClick={() => setSelectedTable(null)}>
                  Back to Tables
                </Button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <SessionManager 
                    tableId={selectedTable.id} 
                    onSessionUpdate={handleManualSessionUpdate}
                  />
                </div>
                
                <div>
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-medium text-lg">Table Details</h3>
                      <Separator />
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-medium">{selectedTable.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span>{selectedTable.type || 'Standard'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Capacity:</span>
                          <span>{selectedTable.capacity || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <span className="capitalize">{selectedTable.status}</span>
                        </div>
                        {selectedTable.group && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Group:</span>
                            <span>{selectedTable.group}</span>
                          </div>
                        )}
                        {selectedTable.notes && (
                          <div className="pt-2">
                            <span className="text-muted-foreground block">Notes:</span>
                            <p className="text-sm mt-1">{selectedTable.notes}</p>
                          </div>
                        )}
                      </div>
                      
                      {hasAdvancedAccess && (
                        <div className="pt-2">
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => {
                              setActiveTab('editor');
                              toast({
                                title: 'Edit Table',
                                description: 'Use the layout editor to modify table properties',
                              });
                            }}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Edit Table
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Table Selected</h3>
                <p className="text-muted-foreground mt-2 mb-4 text-center">
                  Please select a table to manage its session
                </p>
                <Button onClick={() => setActiveTab('tables')}>
                  Select a Table
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tariffs Tab */}
        {hasAdvancedAccess && (
          <TabsContent value="tariffs" className="space-y-4">
            <TariffManager />
          </TabsContent>
        )}

        {/* Floor Plan Tab */}
        {hasAdvancedAccess && (
          <TabsContent value="floorplan" className="space-y-4">
            {activeLayout ? (
              <FloorPlanEditor />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <Image className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Active Layout</h3>
                  <p className="text-muted-foreground mt-2 mb-4 text-center">
                    Please select or create a layout first
                  </p>
                  <Button onClick={() => setActiveTab('layouts')}>
                    Go to Layouts
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default withRoleGuard(TableManagementPage, ['admin', 'manager', 'staff']);
