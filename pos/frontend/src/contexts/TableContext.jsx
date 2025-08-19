import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from '../hooks/use-toast';
import api from '../services/api';

const TableContext = createContext();

export const TableProvider = ({ children }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [activeLayoutId, setActiveLayoutId] = useState(null);

  // Fetch active layout
  const { data: layout, isLoading: isLoadingLayout, error: layoutError } = useQuery({
    queryKey: ['tableLayout', 'active'],
    queryFn: async () => {
      const data = await api.get('/table-layouts/active');
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        setActiveLayoutId(data.id);
      }
    },
  });

  // Fetch tables for the active layout
  // Prefer tables already included on the active layout payload; fallback to API list
  const { 
    data: tables = [], 
    isLoading: isLoadingTables, 
    error: tablesError 
  } = useQuery({
    queryKey: ['tables', activeLayoutId, layout?.updatedAt, Array.isArray(layout?.tables) ? layout.tables.length : 0],
    queryFn: async () => {
      if (!activeLayoutId) return [];
      if (layout && Array.isArray(layout.tables) && layout.tables.length > 0) {
        // Map backend property names (positionX, positionY) to frontend expected names (x, y)
        return layout.tables.map((table) => ({  // table is from layout.tables
          ...table,
          x: table.positionX,
          y: table.positionY
        }));
      }
      const data = await api.get(`/tables?layoutId=${activeLayoutId}`);
      // Map backend property names to frontend expected names
      return data.map((table) => ({  // table is from API response
        ...table,
        x: table.positionX,
        y: table.positionY
      }));
    },
    enabled: !!activeLayoutId,
  });

  // Fetch all layouts for selection
  const { data: layouts = [] } = useQuery({
    queryKey: ['tableLayouts'],
    queryFn: async () => {
      const data = await api.get('/table-layouts');
      return data;
    },
  });

  // Update table position
  const updateTablePositionMutation = useMutation({
    mutationFn: async ({ id, positionX, positionY }) => {
      await api.patch(`/tables/${id}`, { positionX, positionY });
    },
    onSuccess: () => {
      // Invalidate all tables-related queries and refresh active layout to sync embedded tables
      queryClient.invalidateQueries({ queryKey: ['tables'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['tableLayout', 'active'] });
    },
    onError: (error) => {
      console.error('Error updating table position:', error);
      toast({
        title: 'Error',
        description: 'Failed to update table position. Please try again.',
        status: 'error',
      });
    },
  });

  // Update table dimensions
  const updateTableDimensionsMutation = useMutation({
    mutationFn: async ({ id, width, height }) => {
      await api.patch(`/tables/${id}`, { width, height });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', activeLayoutId] });
    },
    onError: (error) => {
      console.error('Error updating table dimensions:', error);
      toast({
        title: 'Error',
        description: 'Failed to update table dimensions. Please try again.',
        status: 'error',
      });
    },
  });

  // Update table rotation
  const updateTableRotationMutation = useMutation({
    mutationFn: async ({ id, rotation }) => {
      await api.patch(`/tables/${id}`, { rotation });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', activeLayoutId] });
    },
    onError: (error) => {
      console.error('Error updating table rotation:', error);
      toast({
        title: 'Error',
        description: 'Failed to update table rotation. Please try again.',
        status: 'error',
      });
    },
  });

  // Update table status
  const updateTableStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      await api.patch(`/tables/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['tableLayout', 'active'] });
      toast({
        title: 'Status updated',
        description: 'Table status has been updated.',
        status: 'success',
      });
    },
    onError: (error) => {
      console.error('Error updating table status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update table status. Please try again.',
        status: 'error',
      });
    },
  });

  // Create a new table
  const createTableMutation = useMutation({
    mutationFn: async (tableData) => {
      // Prevent invalid request if active layout is not ready
      if (!activeLayoutId) {
        const err = new Error('Missing active layout. Please create or activate a layout first.');
        err.code = 'NO_ACTIVE_LAYOUT';
        throw err;
      }
      const data = await api.post('/tables', {
        ...tableData,
        layoutId: activeLayoutId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['tableLayout', 'active'] });
      toast({
        title: 'Table created',
        description: 'A new table has been added to the layout.',
        status: 'success',
      });
    },
    onError: (error) => {
      // Surface backend message if available
      const serverMsg = error?.code === 'NO_ACTIVE_LAYOUT'
        ? 'Please create or activate a layout before adding tables.'
        : (error?.response?.data?.message || error?.message);
      console.error('Error creating table:', serverMsg, error);
      toast({
        title: 'Error creating table',
        description: serverMsg || 'Failed to create table. Please try again.',
        status: 'error',
      });
    },
  });

  // Update table
  const updateTableMutation = useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const data = await api.patch(`/tables/${id}`, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['tableLayout', 'active'] });
      toast({
        title: 'Table updated',
        description: 'Table has been updated successfully.',
        status: 'success',
      });
    },
    onError: (error) => {
      console.error('Error updating table:', error);
      toast({
        title: 'Error',
        description: 'Failed to update table. Please try again.',
        status: 'error',
      });
    },
  });

  // Delete table
  const deleteTableMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/tables/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['tableLayout', 'active'] });
      setSelectedTableId(null);
      toast({
        title: 'Table deleted',
        description: 'The table has been removed from the layout.',
        status: 'success',
      });
    },
    onError: (error) => {
      console.error('Error deleting table:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete table. Please try again.',
        status: 'error',
      });
    },
  });

  // Save layout
  const saveLayoutMutation = useMutation({
    mutationFn: async (layoutData) => {
      if (layoutData.id) {
        const data = await api.put(`/table-layouts/${layoutData.id}`, layoutData);
        return data;
      } else {
        const data = await api.post('/table-layouts', layoutData);
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tableLayouts'] });
      queryClient.invalidateQueries({ queryKey: ['tableLayout', 'active'] });
      toast({
        title: 'Layout saved',
        description: 'Your layout changes have been saved.',
        status: 'success',
      });
      return data;
    },
    onError: (error) => {
      console.error('Error saving layout:', error);
      toast({
        title: 'Error',
        description: 'Failed to save layout. Please try again.',
        status: 'error',
      });
    },
  });

  // Wrapper functions for mutations
  const updateTablePosition = useCallback((tableId, x, y) => {  // tableId: string, x/y: numbers
    // Map frontend property names (x, y) to backend expected names (positionX, positionY)
    updateTablePositionMutation.mutate({ id: tableId, positionX: x, positionY: y });
  }, [updateTablePositionMutation]);

  const updateTableDimensions = useCallback((id, width, height) => {  // id: string, width/height: numbers
    updateTableDimensionsMutation.mutate({ id, width, height });
  }, [updateTableDimensionsMutation]);

  const updateTableRotation = useCallback((id, rotation) => {  // id: string, rotation: number
    updateTableRotationMutation.mutate({ id, rotation });
  }, []);

  const updateTableStatus = useCallback((id, status) => {
    updateTableStatusMutation.mutate({ id, status });
  }, []);

  const createTable = useCallback((tableData) => {
    if (!activeLayoutId) {
      toast({
        title: 'No active layout',
        description: 'Please create or activate a layout before adding tables.',
        status: 'warning',
      });
      return Promise.reject(new Error('No active layout'));
    }
    return createTableMutation.mutateAsync(tableData);
  }, [activeLayoutId]);

  const updateTable = useCallback((id, updates) => {
    return updateTableMutation.mutateAsync({ id, ...updates });
  }, []);

  const deleteTable = useCallback((id) => {
    return deleteTableMutation.mutateAsync(id);
  }, []);

  const saveLayout = useCallback((layoutData) => {
    return saveLayoutMutation.mutateAsync(layoutData);
  }, []);

  // Loading and error states
  const isLoading = isLoadingLayout || isLoadingTables;
  const error = layoutError || tablesError;

  // Exposed values and actions
  const value = {
    // State
    layout,
    tables,
    layouts,
    selectedTableId,
    activeLayoutId,
    loading: isLoading,
    error,
    
    // Actions
    setSelectedTableId,
    setActiveLayoutId,
    updateTablePosition,
    updateTableDimensions,
    updateTableRotation,
    updateTableStatus,
    createTable,
    updateTable,
    deleteTable,
    saveLayout,
  };

  return (
    <TableContext.Provider value={value}>
      {children}
    </TableContext.Provider>
  );
};

export const useTableContext = () => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTableContext must be used within a TableProvider');
  }
  return context;
};

export default TableContext;
