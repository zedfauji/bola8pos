import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSocket } from './socket-context.jsx';
import { useToast } from '../hooks/use-toast';
import api from '../lib/axios';

// Use centralized axios instance (baseURL already includes '/api')

/**
 * @typedef {Object} TableType
 * @property {string} id - Table ID
 * @property {string} name - Table name
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} width - Width
 * @property {number} height - Height
 * @property {number} rotation - Rotation in degrees
 * @property {string} status - Table status
 * @property {string} [shape] - Table shape
 * @property {number} [capacity] - Table capacity
 * @property {string} [floor] - Floor location ('interno', 'terraza')
 * @property {'regular'|'billiard'|'bar'} [type] - Table type
 * @property {string} [group] - Logical grouping/zone of the table
 * @property {string} [notes] - Additional notes for the table
 * @property {string} layoutId - ID of the layout this table belongs to
 * @property {Object} [currentSession] - Current active session data if any
 */

/**
 * @typedef {Object} LayoutType
 * @property {string} id - Layout ID
 * @property {string} name - Layout name
 * @property {number} width - Layout width
 * @property {number} height - Layout height
 * @property {boolean} [isActive] - Whether the layout is active
 * @property {string} [created_by] - Creator user id
 * @property {TableType[]} [tables] - Tables in the layout
 */

/**
 * @typedef {Object} TableContextType
 * @property {TableType[]} tables - List of tables
 * @property {LayoutType[]} layouts - List of layouts
 * @property {LayoutType|null} activeLayout - Currently active layout
 * @property {string|null} activeLayoutId - ID of the active layout
 * @property {boolean} loading - Loading state
 * @property {function(LayoutType): Promise<LayoutType>} saveLayout - Save layout function
 * @property {function(LayoutType): Promise<LayoutType>} createLayout - Create layout function
 * @property {function(string): Promise<void>} deleteLayout - Delete layout function
 * @property {function(string): Promise<{id: string}>} setActiveLayout - Set active layout function
 * @property {function(TableType): Promise<TableType>} addTable - Add table function
 * @property {function(TableType): Promise<TableType>} updateTable - Update table function
 * @property {function(string): Promise<void>} deleteTable - Delete table function
 * @property {function(TableType): void} updateTableInList - Update a table in the current tables list
 * @property {function(string): Promise<TableType[]>} fetchTables - Fetch tables for a specific layout
 */

// Create context with default value
/** @type {TableContextType} */
const defaultContextValue = {
  tables: [],
  layouts: [],
  activeLayout: null,
  activeLayoutId: null,
  loading: false,
  saveLayout: async () => (/** @type {LayoutType} */ ({ id: '', name: '', width: 0, height: 0 })),
  createLayout: async () => (/** @type {LayoutType} */ ({ id: '', name: '', width: 0, height: 0 })),
  deleteLayout: async () => {},
  setActiveLayout: async () => ({ id: '' }),
  addTable: async () => (/** @type {TableType} */ ({ id: '', name: '', x: 0, y: 0, width: 0, height: 0, rotation: 0, status: '', layoutId: '' })),
  updateTable: async () => (/** @type {TableType} */ ({ id: '', name: '', x: 0, y: 0, width: 0, height: 0, rotation: 0, status: '', layoutId: '' })),
  deleteTable: async () => {},
  updateTableInList: () => {},
  fetchTables: async () => (/** @type {TableType[]} */ ([]))
};

/** @type {import('react').Context<TableContextType>} */
const TableContext = createContext(defaultContextValue);

// Provider component
/**
 * Table context provider
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export const TableProvider = ({ children }) => {
  const queryClient = useQueryClient();
  
  // State
  const [selectedTableId, setSelectedTableId] = useState(/** @type {string|null} */ (null));
  const [activeLayoutId, setActiveLayoutId] = useState(/** @type {string|null} */ (null));

  // Socket integration
  const { socket } = useSocket();
  const { toast } = useToast();

  /**
   * Handle WebSocket messages
   * @param {{type: string, [key: string]: any}} message - The message received from WebSocket
   */
  const handleSocketMessage = useCallback((/** @type {{type: string, [key: string]: any}} */ message) => {
    console.log('WebSocket message received in table context:', message);
    
    // Handle different message types
    if (message.type === 'layout_updated') {
      queryClient.invalidateQueries({ queryKey: ['layouts'] });
    } else if (message.type === 'layout_activated') {
      queryClient.invalidateQueries({ queryKey: ['layouts'] });
      queryClient.invalidateQueries({ queryKey: ['activeLayout'] });
    }
  }, [queryClient]);
  
  // Set up socket event listener
  useEffect(() => {
    if (socket) {
      socket.on('message', handleSocketMessage);
      return () => {
        socket.off('message', handleSocketMessage);
      };
    }
  }, [socket, handleSocketMessage]);

  // Fetch layouts
  const { data: layouts = /** @type {LayoutType[]} */ ([]), isLoading: layoutsLoading } = useQuery({ 
    queryKey: ['layouts'],
    queryFn: async () => {
      const response = await api.get('/table-layouts');
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch active layout
  const { data: activeLayoutData, isLoading: activeLayoutLoading } = useQuery({
    queryKey: ['activeLayout'],
    queryFn: async () => {
      const response = await api.get('/table-layouts/active');
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !layoutsLoading, // Only run after layouts are loaded
  });

  // Set active layout ID from fetched data
  useEffect(() => {
    if (activeLayoutData && activeLayoutData.id) {
      setActiveLayoutId(activeLayoutData.id);
    }
  }, [activeLayoutData]);

  // State for tables (for real-time updates)
  const [tables, setTables] = useState(/** @type {TableType[]} */ ([]));
  
  // Fetch tables for active layout
  const { data: fetchedTables = /** @type {TableType[]} */ ([]), isLoading: tablesLoading } = useQuery({
    queryKey: ['tables', activeLayoutId],
    queryFn: async () => {
      if (!activeLayoutId) return [];
      const response = await api.get(`/tables?layoutId=${activeLayoutId}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!activeLayoutId,
  });
  
  // Update tables state when fetched tables change
  useEffect(() => {
    if (fetchedTables && fetchedTables.length > 0) {
      setTables(fetchedTables);
    }
  }, [fetchedTables]);

  // Loading states
  const isLoadingLayouts = layoutsLoading;
  const isLoadingActiveLayout = activeLayoutLoading;
  const isLoadingTables = tablesLoading;
  
  // Get active layout from layouts
  /** @type {LayoutType|null} */
  const activeLayout = activeLayoutId ? layouts.find(/** @param {LayoutType} layout */ layout => layout.id === activeLayoutId) : null;

  // Save layout mutation
  const saveLayoutMutation = useMutation({
    /**
     * @param {LayoutType} layoutData - Layout data to save
     * @returns {Promise<LayoutType>}
     */
    mutationFn: async (layoutData) => {
      if (layoutData.id) {
        const { data } = await api.put(`/table-layouts/${layoutData.id}`, layoutData);
        return data;
      } else {
        const { data } = await api.post('/table-layouts', layoutData);
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['layouts'] });
      queryClient.invalidateQueries({ queryKey: ['activeLayout'] });
      
      // If this is a new layout, set it as active
      if (data && !activeLayoutId) {
        setActiveLayoutId(data.id);
      }
      
      // Socket integration
      if (socket) {
        socket.emit('layout_updated', data);
      }
      toast({
        title: 'Layout saved',
        description: 'The layout has been saved successfully',
      });
      return data;
    },
    onError: (/** @type {Error & {response?: {data?: {message?: string}}} } */ error) => {
      console.error('Error saving layout:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save layout',
        variant: 'destructive',
      });
    },
  });

  // Delete layout mutation
  const deleteLayoutMutation = useMutation({
    /**
     * @param {string} id - The layout ID to delete
     * @returns {Promise<any>}
     */
    mutationFn: (id) => api.delete(`/table-layouts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layouts'] });
      toast({
        title: 'Layout deleted',
        description: 'The layout has been deleted successfully',
      });
    },
    onError: (/** @type {Error} */ error) => {
      console.error('Error deleting layout:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete layout',
        variant: 'destructive',
      });
    },
  });

  // Set active layout mutation
  const setActiveLayoutMutation = useMutation({
    /**
     * @param {string} id - Layout ID
     * @returns {Promise<{id: string}>}
     */
    mutationFn: async (id) => {
      const { data } = await api.put(`/table-layouts/${id}/activate`);
      return data;
    },
    onSuccess: (data) => {
      setActiveLayoutId(data.id);
      queryClient.invalidateQueries({ queryKey: ['layouts'] });
      queryClient.invalidateQueries({ queryKey: ['activeLayout'] });
      
      toast({
        title: 'Layout activated',
        description: 'The layout has been activated successfully',
      });
    },
    onError: (/** @type {Error & {response?: {data?: {message?: string}}} } */ error) => {
      console.error('Error activating layout:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to activate layout',
        variant: 'destructive',
      });
    },
  });

  /**
   * Add a new table to the active layout
   * @param {TableType} tableData - Table data
   * @returns {Promise<TableType>}
   */
  const addTable = useCallback(async (/** @type {TableType} */ tableData) => {
    if (!activeLayoutId) throw new Error('No active layout');
    // Map frontend fields to backend expected payload
    const payload = {
      name: tableData.name,
      group: tableData.group || 'Hall',
      capacity: tableData.capacity ?? 4,
      positionX: Math.round(tableData.x),
      positionY: Math.round(tableData.y),
      rotation: tableData.rotation ?? 0,
      width: tableData.width,
      height: tableData.height,
      notes: tableData.notes || '',
      layoutId: activeLayoutId,
      type: tableData.type || 'billiard',
    };
    const { data } = await api.post('/tables', payload);
    queryClient.invalidateQueries({ queryKey: ['tables', activeLayoutId] });
    return data;
  }, [activeLayoutId, queryClient]);

  /**
   * Update a table
   * @param {TableType} tableData - Table data
   * @returns {Promise<TableType>}
   */
  const updateTable = useCallback(async (/** @type {TableType} */ tableData) => {
    if (!activeLayoutId) throw new Error('No active layout');
    // Map frontend fields to backend expected payload
    const payload = {
      name: tableData.name,
      group: tableData.group || 'Hall',
      capacity: tableData.capacity ?? 4,
      positionX: Math.round(tableData.x),
      positionY: Math.round(tableData.y),
      rotation: tableData.rotation ?? 0,
      width: tableData.width,
      height: tableData.height,
      notes: tableData.notes || '',
      layoutId: activeLayoutId,
      type: tableData.type || 'billiard',
      status: tableData.status,
    };
    const { data } = await api.put(`/tables/${tableData.id}`, payload);
    queryClient.invalidateQueries({ queryKey: ['tables', activeLayoutId] });
    return data;
  }, [activeLayoutId, queryClient]);

  /**
   * Delete a table
   * @param {string} id - Table ID
   * @returns {Promise<void>}
   */
  const deleteTable = useCallback(async (/** @type {string} */ id) => {
    if (!activeLayoutId) throw new Error('No active layout');
    await api.delete(`/tables/${id}`);
    queryClient.invalidateQueries({ queryKey: ['tables', activeLayoutId] });
    if (selectedTableId === id) {
      setSelectedTableId(null);
    }
  }, [activeLayoutId, queryClient, selectedTableId]);

  // Loading state
  const loading = isLoadingLayouts || isLoadingActiveLayout || isLoadingTables;

  /**
   * Update a single table in the list (for real-time updates)
   * @param {TableType} updatedTable - The updated table data
   */
  const updateTableInList = useCallback((/** @type {TableType} */ updatedTable) => {
    setTables(prevTables => {
      // Check if the table already exists in the list
      const tableExists = prevTables.some(table => table.id === updatedTable.id);
      
      if (tableExists) {
        // Update the existing table
        return prevTables.map(table => 
          table.id === updatedTable.id ? updatedTable : table
        );
      } else if (updatedTable.layoutId === activeLayoutId) {
        // Add the new table if it belongs to the current layout
        return [...prevTables, updatedTable];
      } else {
        // No changes needed
        return prevTables;
      }
    });
  }, [activeLayoutId]);

  // Function to fetch tables for a specific layout
  const fetchTables = useCallback(async (/** @type {string} */ layoutId) => {
    if (!layoutId) return [];
    try {
      const response = await api.get(`/tables?layoutId=${layoutId}`);
      const fetchedTables = response.data;
      setTables(fetchedTables);
      return fetchedTables;
    } catch (error) {
      console.error('Error fetching tables:', error);
      return [];
    }
  }, [api, setTables]);

  /**
   * Create a new layout
   * @param {LayoutType} layoutData - Layout data
   * @returns {Promise<LayoutType>}
   */
  const createLayout = (layoutData) => {
    return saveLayoutMutation.mutateAsync(layoutData);
  };

  // Context value
  /** @type {TableContextType} */
  const value = {
    layouts,
    activeLayout,
    tables,
    activeLayoutId,
    loading,
    saveLayout: saveLayoutMutation.mutateAsync,
    createLayout,
    deleteLayout: deleteLayoutMutation.mutateAsync,
    setActiveLayout: setActiveLayoutMutation.mutateAsync,
    addTable,
    updateTable,
    deleteTable,
    updateTableInList,
    fetchTables
  };

  return (
    <TableContext.Provider value={value}>
      {children}
    </TableContext.Provider>
  );
};

// ... (rest of the code remains the same)
export const useTableContext = () => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTableContext must be used within a TableProvider');
  }
  return context;
};

export default TableContext;
