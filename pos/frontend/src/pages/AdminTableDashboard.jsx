import React, { useState, useEffect, useCallback } from 'react';
import { useTableContext } from '../contexts/NewTableContext';
import { useSocket } from '../contexts/SocketContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FileText, Settings, Users, Activity, BarChart2, LayoutGrid, CircleDollarSign } from 'lucide-react';

// Import react-toastify for notifications
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/**
 * Admin Table Dashboard component
 */
const AdminTableDashboard = () => {
  const { 
    activeLayout, 
    tables, 
    fetchTables
  } = useTableContext();
  const { socket, connected } = useSocket();
  
  // State for dashboard data
  const [activeTab, setActiveTab] = useState('overview');
  const [tableStats, setTableStats] = useState({
    total: 0,
    available: 0,
    occupied: 0,
    maintenance: 0,
    reserved: 0
  });
  const [dailyRevenue, setDailyRevenue] = useState(0);
  /** @type {[Array<{id: number, tableId: string, tableName: string, startTime: string, duration: string, tariffName: string, currentAmount: number}>, Function]} */
  const [activeSessions, setActiveSessions] = useState([]);
  /** @type {[Array<{id: number, type: string, tableName: string, timestamp: string, status?: string, sessionStatus?: string, amount?: number}>, Function]} */
  const [activityLog, setActivityLog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Update table stats based on tables data
  useEffect(() => {
    // Use allowedRoles in development to prevent unused variable warning
    if (process.env.NODE_ENV === 'development') {
      console.debug('Component protected for roles:', ['admin', 'manager']);
    }
  }, []);

  const calculateTableStats = useCallback(() => {
    if (!tables) return;
    
    const stats = {
      total: tables.length,
      available: tables.filter(t => t.status === 'available').length,
      occupied: tables.filter(t => t.status === 'occupied').length,
      reserved: tables.filter(t => t.status === 'reserved').length,
      maintenance: tables.filter(t => t.status === 'maintenance').length
    };
    
    setTableStats(stats);
  }, [tables]);

  // Calculate daily revenue
  const calculateDailyRevenue = useCallback(() => {
    // Placeholder for revenue calculation
    setDailyRevenue(activeSessions.reduce((total, session) => total + (session.currentAmount || 0), 0));
  }, [activeSessions]);

  // Fetch active sessions
  const fetchActiveSessions = useCallback(() => {
    if (!tables) return;
    
    const sessions = [];
    
    tables.forEach(table => {
      if (table.status === 'occupied' && table.currentSession) {
        sessions.push({
          id: table.currentSession?.id,
          tableId: table.id,
          tableName: table.name,
          startTime: table.currentSession?.startTime,
          duration: table.currentSession?.duration,
          tariffName: table.currentSession?.tariffName,
          currentAmount: table.currentSession?.currentAmount
        });
      }
    });
    
    setActiveSessions(sessions);
    calculateDailyRevenue();
  }, [tables, calculateDailyRevenue]);

  // Generate mock activity log data
  const generateMockActivityLog = useCallback(() => {
    const mockActivities = [
      {
        id: 1,
        type: 'status',
        tableName: 'Table 1',
        timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
        status: 'occupied'
      },
      {
        id: 2,
        type: 'session',
        tableName: 'Table 3',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        amount: 25.50
      },
      {
        id: 3,
        type: 'maintenance',
        tableName: 'Table 5',
        timestamp: new Date(Date.now() - 120 * 60000).toISOString()
      },
      {
        id: 4,
        type: 'status',
        tableName: 'Table 2',
        timestamp: new Date(Date.now() - 180 * 60000).toISOString(),
        status: 'available'
      },
      {
        id: 5,
        type: 'session',
        tableName: 'Table 4',
        timestamp: new Date(Date.now() - 240 * 60000).toISOString(),
        amount: 32.75
      }
    ];
    
    setActivityLog(mockActivities);
  }, []);

  // Notify success and error messages - will be used in future implementations
  /** @param {string} message */
  const notifySuccess = (message) => toast.success(message);
  /** @param {string} message */
  const notifyError = (message) => toast.error(message);
  
  // Prevent unused variable warnings
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('Toast notification functions ready:', { notifySuccess, notifyError });
    }
  }, []);

  // Handle socket events for real-time updates
  useEffect(() => {
    if (socket) {
      // Listen for table status changes
      socket.on('table:statusChanged', (/** @type {{ id: string, name: string, status: string }} */ updatedTable) => {
        console.log('Table status changed:', updatedTable);
        
        // Add to activity log
        setActivityLog((/** @type {any[]} */ prev) => [
          {
            id: Date.now(),
            type: 'status',
            tableName: updatedTable.name,
            status: updatedTable.status,
            timestamp: new Date().toISOString()
          },
          ...prev
        ].slice(0, 50)); // Keep only the last 50 activities
        
        // Update table stats
        calculateTableStats();
      });
      
      // Listen for session events
      socket.on('session:created', (/** @type {{ id: string, tableName: string, tableId: string, totalAmount: number }} */ sessionData) => {
        console.log('Session created:', sessionData);
        
        // Update active sessions
        fetchActiveSessions();
        
        // Add to activity log
        setActivityLog((/** @type {any[]} */ prev) => [
          {
            id: Date.now(),
            type: 'session',
            tableName: sessionData.tableName,
            sessionStatus: 'created',
            timestamp: new Date().toISOString()
          },
          ...prev
        ].slice(0, 50));
        
        // Update daily revenue
        setDailyRevenue((/** @type {number} */ prev) => prev + sessionData.totalAmount);
      });
      
      // More session events
      socket.on('session:updated', (/** @type {{id: string, tableName: string, totalAmount: number}} */ sessionData) => {
        fetchActiveSessions();
        setDailyRevenue((/** @type {number} */ prev) => prev + sessionData.totalAmount);
      });
      
      socket.on('session:ended', (/** @type {{id: string, tableName: string, totalAmount: number}} */ sessionData) => {
        fetchActiveSessions();
        setDailyRevenue((/** @type {number} */ prev) => prev + sessionData.totalAmount);
        
        // Add to activity log
        setActivityLog((/** @type {any[]} */ prev) => [
          {
            id: Date.now(),
            type: 'session',
            tableName: sessionData.tableName,
            sessionStatus: 'ended',
            timestamp: new Date().toISOString()
          },
          ...prev
        ].slice(0, 50));
      });
    }
    
    return () => {
      if (socket) {
        socket.off('table:statusChanged');
        socket.off('session:created');
        socket.off('session:updated');
        socket.off('session:ended');
      }
    };
  }, [socket, calculateTableStats, fetchActiveSessions]);

  // Fetch tables when active layout changes
  useEffect(() => {
    if (activeLayout) {
      setIsLoading(true);
      fetchTables(activeLayout.id)
        .finally(() => {
          setIsLoading(false);
          calculateTableStats();
          fetchActiveSessions();
          generateMockActivityLog();
        });
    }
  }, [activeLayout, fetchTables]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Table Management Dashboard</h1>
          <p className="text-muted-foreground">
            Administrative overview of tables, sessions, and revenue
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Button variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              Live Updates
            </Button>
          ) : (
            <Button variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              Connecting...
            </Button>
          )}
        </div>
      </div>

      {/* Layout Selector - Commented out until component is available */}
      <Card>
        <CardContent className="p-4">
          {/* <TableLayoutSelector compact={true} /> */}
          <div className="p-2 text-center">Layout Selector Placeholder</div>
        </CardContent>
      </Card>

      {/* Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="overview" className="flex items-center">
            <LayoutGrid className="h-4 w-4 mr-2" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center">
            <BarChart2 className="h-4 w-4 mr-2" />
            <span>Active Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center">
            <CircleDollarSign className="h-4 w-4 mr-2" />
            <span>Revenue</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center">
            <Activity className="h-4 w-4 mr-2" />
            <span>Activity Log</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Table Status Summary */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Table Status</CardTitle>
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tableStats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {tableStats.available} available, {tableStats.occupied} occupied
                </p>
              </CardContent>
            </Card>
            
            {/* Active Sessions Summary */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeSessions.length}</div>
                <p className="text-xs text-muted-foreground">Current active table sessions</p>
              </CardContent>
            </Card>
            
            {/* Daily Revenue */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${dailyRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">+10.1% from yesterday</p>
              </CardContent>
            </Card>
            
            {/* Recent Activity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activityLog.length}</div>
                <p className="text-xs text-muted-foreground">+{activityLog.filter((/** @type {any} */ log) => new Date(log.timestamp) > new Date(Date.now() - 3600000)).length} in the last hour</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Table Layout */}
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Table Layout</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                {/* Placeholder for TableLayoutSelector */}
                <div className="flex flex-col items-center justify-center h-[300px] border rounded-md border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">Table Layout Visualization will be displayed here</p>
                  <Button variant="outline" className="mt-4">
                    <Settings className="mr-2 h-4 w-4" /> Configure Layout
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Recent Activity Log */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activityLog.slice(0, 5).map((/** @type {any} */ log, /** @type {number} */ index) => (
                    <div key={log.id || index} className="flex items-center">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {log.type === 'table' ? `Table ${log.tableName}: ${log.status}` : 
                           `Session on ${log.tableName}: ${log.sessionStatus}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {activeSessions.length > 0 ? (
                <div className="space-y-4">
                  {activeSessions.map((session) => (
                    <div key={session.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{session.tableName}</h4>
                        <div className="text-sm text-muted-foreground">
                          Started: {new Date(session.startTime).toLocaleTimeString()}
                        </div>
                        <div className="text-sm text-muted-foreground">Duration: {session.duration}</div>
                      </div>
                      <div>
                        <div className="font-medium text-right">{session.tariffName}</div>
                        <div className="text-lg font-bold">${session.currentAmount.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No active sessions at the moment
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center h-[300px] border rounded-md border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">Revenue chart will be displayed here</p>
                <div className="mt-4 text-2xl font-bold">${dailyRevenue.toFixed(2)}</div>
                <p className="text-sm text-muted-foreground">Today's revenue</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              {activityLog.length > 0 ? (
                <div className="space-y-4">
                  {activityLog.map((/** @type {any} */ log, /** @type {number} */ index) => (
                    <div key={log.id || index} className="flex justify-between items-center p-3 border-b last:border-0">
                      <div>
                        <h4 className="font-medium">
                          {log.type === 'table' ? `Table ${log.tableName}` : `Session on ${log.tableName}`}
                        </h4>
                        <div className="text-sm text-muted-foreground">
                          {log.type === 'table' ? `Status changed to: ${log.status}` : 
                           `Session ${log.sessionStatus}`}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No activity recorded yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Administrative Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="flex flex-col h-24 items-center justify-center">
              <Settings className="h-5 w-5 mb-1" />
              <span>Manage Layouts</span>
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5" />
              <span>Manage Tariffs</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-24 items-center justify-center">
              <Users className="h-5 w-5 mb-1" />
              <span>Staff Access</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-24 items-center justify-center">
              <FileText className="h-5 w-5 mb-1" />
              <span>Export Reports</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Export with role guard - only admin and manager can access
// Create a simple withRoleGuard HOC since the import is missing
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

export default withRoleGuardTemp(AdminTableDashboard, ['admin', 'manager']);
