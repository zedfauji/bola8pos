import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useTableContext } from '../contexts/NewTableContext';
import { useSocket } from '../contexts/SocketContext';
import { withRoleGuard } from '../hoc/withRoleGuard';
import { 
  LayoutGrid, Clock, PlayCircle, PauseCircle, 
  StopCircle, Users, Search, AlertCircle
} from 'lucide-react';

// Import components
import TableLayoutSelector from '../components/tables/TableLayoutSelector';
import QuickSessionActions from '../components/tables/QuickSessionActions';

/**
 * Staff Table Dashboard component
 */
const StaffTableDashboard = () => {
  const { toast } = useToast();
  const { 
    activeLayout, 
    tables, 
    fetchTables, 
    updateTableInList 
  } = useTableContext();
  const { socket, connected, subscribe, joinRoom, leaveRoom } = useSocket();
  
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} */
  const [activeTab, setActiveTab] = useState('tables');
  /** @type {[any, React.Dispatch<React.SetStateAction<any>>]} */
  const [selectedTable, setSelectedTable] = useState(null);
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} */
  const [searchQuery, setSearchQuery] = useState('');
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} */
  const [isLoading, setIsLoading] = useState(true);

  // Filter tables based on search query
  const filteredTables = tables.filter(table => 
    table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (table.type && table.type.toLowerCase().includes(searchQuery.toLowerCase())) ||
    table.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle real-time table updates
  const handleTableUpdate = useCallback((/** @type {any} */ updatedTable) => {
    console.log('Received table update:', updatedTable);
    updateTableInList(updatedTable);
    
    // If the updated table is the selected one, update the selection
    if (selectedTable && selectedTable.id === updatedTable.id) {
      setSelectedTable(updatedTable);
    }
    
    toast({
      title: 'Table Updated',
      description: `Table ${updatedTable.name} has been updated`,
    });
  }, [updateTableInList, selectedTable, toast]);

  // Handle real-time session updates
  const handleSessionUpdate = useCallback((/** @type {any} */ sessionData) => {
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
        
        // If the updated table is the selected one, update the selection
        if (selectedTable && selectedTable.id === updatedTable.id) {
          setSelectedTable(updatedTable);
        }
      }
    }
    
    toast({
      title: 'Session Updated',
      description: `Session on table ${sessionData.tableName || 'unknown'} is now ${sessionData.status}`,
    });
  }, [tables, updateTableInList, selectedTable, toast]);

  // Socket.io integration for real-time updates
  useEffect(() => {
    if (socket && activeLayout) {
      // Join room for the active layout
      joinRoom(`layout_${activeLayout.id}`);
      
      // Subscribe to events
      subscribe('table_updated', handleTableUpdate);
      subscribe('session_updated', handleSessionUpdate);
      
      return () => {
        leaveRoom(`layout_${activeLayout.id}`);
        // Unsubscribe handled by the socket context
      };
    }
  }, [socket, activeLayout, handleTableUpdate, handleSessionUpdate, subscribe, joinRoom, leaveRoom]);

  // Fetch tables when active layout changes
  useEffect(() => {
    if (activeLayout) {
      setIsLoading(true);
      fetchTables(activeLayout.id)
        .finally(() => setIsLoading(false));
    }
  }, [activeLayout, fetchTables]);

  // Handle table selection
  const handleTableSelect = (/** @type {any} */ table) => {
    setSelectedTable(table);
    setActiveTab('session');
  };

  // Handle session actions
  const handleStartSession = async (/** @type {string} */ tableId, /** @type {string} */ tariffId) => {
    try {
      // In a real implementation, this would be an API call
      console.log(`Starting session on table ${tableId} with tariff ${tariffId}`);
      toast({
        title: 'Session Started',
        description: 'The session has been started successfully',
      });
    } catch (error) {
      console.error('Error starting session:', error);
      toast({
        title: 'Error',
        description: 'Failed to start session',
        variant: 'destructive'
      });
    }
  };

  const handlePauseSession = async (/** @type {string} */ sessionId) => {
    try {
      // In a real implementation, this would be an API call
      console.log(`Pausing session ${sessionId}`);
      toast({
        title: 'Session Paused',
        description: 'The session has been paused',
      });
    } catch (error) {
      console.error('Error pausing session:', error);
      toast({
        title: 'Error',
        description: 'Failed to pause session',
        variant: 'destructive'
      });
    }
  };

  const handleEndSession = async (/** @type {string} */ sessionId) => {
    try {
      // In a real implementation, this would be an API call
      console.log(`Ending session ${sessionId}`);
      toast({
        title: 'Session Ended',
        description: 'The session has been ended successfully',
      });
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: 'Error',
        description: 'Failed to end session',
        variant: 'destructive'
      });
    }
  };

  // Get status color
  const getStatusColor = (/** @type {string} */ status) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-red-500';
      case 'reserved': return 'bg-yellow-500';
      case 'maintenance': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  // Get status badge
  const getStatusBadge = (/** @type {string} */ status) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Available</Badge>;
      case 'occupied':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Occupied</Badge>;
      case 'reserved':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Reserved</Badge>;
      case 'maintenance':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Maintenance</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Table Management</h1>
          <p className="text-muted-foreground">
            View and manage tables and sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              Live Updates
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              Connecting...
            </Badge>
          )}
        </div>
      </div>

      {/* Layout Selector */}
      <Card>
        <CardContent className="p-4">
          <TableLayoutSelector compact={true} />
        </CardContent>
      </Card>

      {/* Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-3 w-full">
          <TabsTrigger value="tables" className="flex items-center">
            <LayoutGrid className="h-4 w-4 mr-2" />
            <span>Tables</span>
          </TabsTrigger>
          <TabsTrigger value="session" className="flex items-center" disabled={!selectedTable}>
            <Clock className="h-4 w-4 mr-2" />
            <span>Session Management</span>
          </TabsTrigger>
          <TabsTrigger value="occupied" className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            <span>Active Sessions</span>
          </TabsTrigger>
        </TabsList>

        {/* Tables Tab */}
        <TabsContent value="tables" className="space-y-4">
          {activeLayout ? (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Tables in {activeLayout.name}</h2>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search tables..."
                    className="pl-8 pr-4 py-2 border rounded-md"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <p>Loading tables...</p>
                </div>
              ) : filteredTables.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Tables Found</h3>
                    <p className="text-muted-foreground mt-2 mb-4 text-center">
                      {searchQuery ? 'No tables match your search criteria' : 'No tables available in this layout'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTables.map((/** @type {any} */ table) => (
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
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(table.status)}`} />
                        </div>
                        <div className="mt-2">
                          {getStatusBadge(table.status)}
                        </div>
                        {table.status !== 'available' && table.currentSession && (
                          <div className="mt-2 text-xs">
                            {table.currentSession.startTime && (
                              <p>
                                Started: {new Date(table.currentSession.startTime).toLocaleTimeString()}
                              </p>
                            )}
                            {table.currentSession.tariffName && (
                              <p>
                                Tariff: {table.currentSession.tariffName}
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex justify-end">
                        {table.status === 'available' ? (
                          <Button size="sm" onClick={(/** @type {React.MouseEvent} */ e) => {
                            e.stopPropagation();
                            handleTableSelect(table);
                          }}>
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Start Session
                          </Button>
                        ) : table.status === 'occupied' ? (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={(/** @type {React.MouseEvent} */ e) => {
                              e.stopPropagation();
                              handlePauseSession(table.currentSession?.id);
                            }}>
                              <PauseCircle className="h-4 w-4 mr-1" />
                              Pause
                            </Button>
                            <Button size="sm" variant="destructive" onClick={(/** @type {React.MouseEvent} */ e) => {
                              e.stopPropagation();
                              handleEndSession(table.currentSession?.id);
                            }}>
                              <StopCircle className="h-4 w-4 mr-1" />
                              End
                            </Button>
                          </div>
                        ) : table.status === 'reserved' ? (
                          <Button size="sm" onClick={(/** @type {React.MouseEvent} */ e) => {
                            e.stopPropagation();
                            handleStartSession(table.id);
                          }}>
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Resume
                          </Button>
                        ) : (
                          <Button size="sm" disabled>
                            Unavailable
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Active Layout</h3>
                <p className="text-muted-foreground mt-2 mb-4 text-center">
                  Please select a layout first
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Session Management Tab */}
        <TabsContent value="session" className="space-y-4">
          {selectedTable ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Table: {selectedTable.name}</h2>
                  <p className="text-muted-foreground">
                    Manage session for this table
                  </p>
                </div>
                <Button variant="outline" onClick={() => setActiveTab('tables')}>
                  Back to Tables
                </Button>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Session Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <QuickSessionActions 
                    table={selectedTable}
                    onStartSession={handleStartSession}
                    onPauseSession={handlePauseSession}
                    onEndSession={handleEndSession}
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Table Details</CardTitle>
                </CardHeader>
                <CardContent>
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
                      <span>{getStatusBadge(selectedTable.status)}</span>
                    </div>
                    {selectedTable.currentSession && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Session Start:</span>
                          <span>{new Date(selectedTable.currentSession.startTime).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tariff:</span>
                          <span>{selectedTable.currentSession.tariffName || 'Standard'}</span>
                        </div>
                        {selectedTable.currentSession.currentAmount && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Current Amount:</span>
                            <span>${selectedTable.currentSession.currentAmount.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
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

        {/* Active Sessions Tab */}
        <TabsContent value="occupied" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <p>Loading sessions...</p>
                </div>
              ) : tables.filter(t => t.status === 'occupied').length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Active Sessions</h3>
                  <p className="text-muted-foreground mt-2 text-center">
                    There are currently no active sessions
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tables.filter(t => t.status === 'occupied').map((/** @type {any} */ table) => (
                    <Card key={table.id} className="overflow-hidden">
                      <div className="flex border-l-4 border-blue-500">
                        <div className="p-4 flex-grow">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium">{table.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                Started: {table.currentSession ? new Date(table.currentSession.startTime).toLocaleTimeString() : 'Unknown'}
                              </p>
                              {table.currentSession && table.currentSession.tariffName && (
                                <p className="text-sm text-muted-foreground">
                                  Tariff: {table.currentSession.tariffName}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
                                if (table.currentSession) {
                                  handlePauseSession(table.currentSession.id);
                                }
                              }}>
                                <PauseCircle className="h-4 w-4 mr-1" />
                                Pause
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => {
                                if (table.currentSession) {
                                  handleEndSession(table.currentSession.id);
                                }
                              }}>
                                <StopCircle className="h-4 w-4 mr-1" />
                                End
                              </Button>
                            </div>
                          </div>
                          {table.currentSession && table.currentSession.currentAmount && (
                            <div className="mt-2">
                              <span className="font-medium">Current Amount: </span>
                              <span>${table.currentSession.currentAmount.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Create a simple withRoleGuard HOC if the import is missing
/**
 * Simple role guard HOC implementation
 * @param {React.ComponentType<any>} Component - The component to wrap
 * @param {string[]} allowedRoles - The roles allowed to access this component
 * @returns {React.FC<any>} - The wrapped component with role guard
 */
const withRoleGuardTemp = (Component, /** @type {string[]} */ allowedRoles) => {
  // Use allowedRoles in development to prevent unused variable warning
  if (process.env.NODE_ENV === 'development') {
    console.debug('Component protected for roles:', allowedRoles);
  }
  const WithRoleGuard = (/** @type {any} */ props) => {
    // In a real implementation, this would check the user's role
    // For now, we'll just render the component
    return <Component {...props} />;
  };
  return WithRoleGuard;
};

// Use the imported withRoleGuard if available, otherwise use our temp implementation
const exportedComponent = typeof withRoleGuard !== 'undefined' 
  ? withRoleGuard(StaffTableDashboard, ['admin', 'manager', 'staff'])
  : withRoleGuardTemp(StaffTableDashboard, ['admin', 'manager', 'staff']);

export default exportedComponent;
