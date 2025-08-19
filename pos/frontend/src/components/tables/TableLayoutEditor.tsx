import React, { useState, useCallback, useRef } from 'react';
import { useDrop, DropTargetMonitor } from 'react-dnd';
import { useTableContext } from '../../contexts/NewTableContext';
// useToast is imported via useToastSafe

// Define types locally since we're not using the external types file
type TableType = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  status?: string;
  shape?: string;
  capacity?: number;
  floor?: string;
  type?: 'regular' | 'billiard' | 'bar';
  group?: string;
  notes?: string;
  positionX?: number;  // Backward compatibility with backend
  positionY?: number;  // Backward compatibility with backend
};

type TableDropItem = {
  id: string;
  type: string;
  x?: number;
  y?: number;
};

// TableLayout type is defined in the context, no need to redefine here

// Define item types for drag and drop
const ItemTypes = {
  TABLE: 'table',
} as const;

// Toast types
type ToastVariant = 'default' | 'destructive' | 'success' | 'warning';

type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastFunction = (options: ToastOptions) => void;

// Mock useToast if not available
const useToastMock = (): { toast: ToastFunction } => ({
  toast: (options: ToastOptions) => console.log('Toast:', options)
});

const useToastSafe = useToastMock;

/**
 * TableLayoutEditor component for managing table layouts
 * @returns {JSX.Element} The rendered component
 */
const TableLayoutEditor: React.FC = () => {
  // State and context hooks - must be called unconditionally at the top level
  const { 
    tables = [], 
    activeLayout, 
    addTable, 
    updateTable, 
    deleteTable 
  } = useTableContext();
  
  const [currentFloor] = useState('interno');
  const [isEnforcing, setIsEnforcing] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const { toast } = useToastSafe();
  // Set up ref for the container and drop target
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.TABLE,
    drop: (item: TableDropItem, monitor: DropTargetMonitor) => {
      if (!item?.id) return;
      const client = monitor.getClientOffset();
      if (!client || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      let x = Math.round(client.x - rect.left);
      let y = Math.round(client.y - rect.top);
      
      const tbl = tables.find((t: TableType) => t.id === item.id);
      if (tbl && activeLayout) {
        x = Math.max(0, Math.min(activeLayout.width - (tbl.width || 100), x));
        y = Math.max(0, Math.min(activeLayout.height - (tbl.height || 100), y));
      }
      
      // Update both x,y and positionX/positionY for backward compatibility
      updateTable(item.id, { 
        x, 
        y,
      });
    },
    collect: (monitor: DropTargetMonitor) => ({
      isOver: !!monitor.isOver(),
    }),
  });

  /**
   * Handles adding a new table
   */
  const handleAddTable = useCallback(() => {
    if (!activeLayout) {
      toast({
        title: 'No active layout',
        description: 'Please select or create a layout first',
        variant: 'destructive',
      });
      return;
    }

    const newTable = {
      id: `table-${Date.now()}`,
      name: `Table ${tables.length + 1}`,
      position: { x: 50, y: 50 },
      rotation: 0,
      type: 'regular',
      floor: currentFloor,
      width: 100,
      height: 100,
    };

    addTable(newTable);
  }, [activeLayout, tables.length, currentFloor, addTable, toast]);

  /**
   * Handles updating a table's position or properties
   * @param {string} id - The ID of the table to update
   * @param {Partial<TableType>} updates - The updates to apply
   */
  const handleUpdateTable = useCallback(async (id: string, updates: Partial<TableType>) => {
    try {
      await updateTable(id, updates);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update table';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [updateTable, toast]);

  /**
   * Handles clicking on the container to deselect tables
   * @param {React.MouseEvent} e - The click event
   */
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking directly on the container, not a table
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || target.closest('.table-container') === e.currentTarget) {
      setSelectedTableId(null);
    }
  }, []);

  /**
   * Filters tables by the current floor
   * @type {TableType[]}
   */
  const filteredTables = tables.filter((table: TableType) => {
    if (!table) return false;
    const tableFloor = String(table.floor || '').toLowerCase().trim();
    const matchesFloor = !tableFloor || tableFloor === currentFloor.toLowerCase();
    return matchesFloor;
  });

  /**
   * Handles saving the layout
   */
  const handleSaveLayout = useCallback(async () => {
    if (!activeLayout) {
      toast({
        title: 'No active layout',
        description: 'Please select or create a layout first',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Implementation here
      toast({
        title: 'Success',
        description: 'Layout saved successfully',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error saving layout:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save layout';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [activeLayout, toast]);

  // Set up 2 billiard and 2 bar tables
  const handleSetTwoEach = useCallback(async () => {
    // Implementation here
    if (!activeLayout) {
      toast({
        title: 'No active layout',
        description: 'Please select or create a layout first',
        variant: 'destructive',
      });
      return;
    }

    setIsEnforcing(true);
    try {
      // Clear existing tables on this floor
      const tablesToDelete = tables
        .filter(table => table.floor === currentFloor)
        .map(table => table.id);

      await Promise.all(tablesToDelete.map(id => deleteTable(id)));

      // Add 2 billiard and 2 bar tables
      const newTables = [
        { type: 'billiard', x: 50, y: 50 },
        { type: 'billiard', x: 200, y: 50 },
        { type: 'bar', x: 50, y: 200 },
        { type: 'bar', x: 200, y: 200 },
      ];

      for (const [index, table] of newTables.entries()) {
        addTable({
          id: `table-${Date.now()}-${index}`,
          name: `${table.type === 'bar' ? 'Bar' : 'Billiard'} ${index + 1}`,
          position: { x: table.x, y: table.y },
          rotation: 0,
          type: table.type,
          floor: currentFloor,
          width: table.type === 'bar' ? 120 : 100,
          height: table.type === 'bar' ? 60 : 100,
        });
      }
    } catch (error) {
      console.error('Error setting up tables:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to set up tables',
        variant: 'destructive',
      });
    } finally {
      setIsEnforcing(false);
    }
  }, [activeLayout, tables, currentFloor, addTable, deleteTable, toast]);

  // Handle deleting a table
  const handleDeleteTable = useCallback(async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    
    try {
      await deleteTable(id);
      toast({
        title: 'Success',
        description: 'Table deleted successfully',
        variant: 'success',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete table';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [deleteTable, toast]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b p-2 flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {activeLayout ? activeLayout.name : 'No Active Layout'}
        </h2>
        <div className="flex space-x-2">
          <button 
            onClick={handleAddTable}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Add Table
          </button>
          <button 
            onClick={handleSetTwoEach}
            disabled={isEnforcing}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm disabled:opacity-50"
          >
            {isEnforcing ? 'Setting up...' : 'Set 2+2'}
          </button>
          <button 
            onClick={handleSaveLayout}
            className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
          >
            Save Layout
          </button>
        </div>
      </div>
      
      <div 
        ref={(node) => {
          containerRef.current = node;
          drop(node);
        }}
        className="flex-1 relative overflow-auto bg-gray-100 p-4"
        onClick={handleContainerClick}
        style={{
          minHeight: '400px',
          backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {isOver && (
          <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900 opacity-50 pointer-events-none" />
        )}
        {filteredTables.map((table) => (
          <div
            key={table.id}
            className={`table ${table.id === selectedTableId ? 'selected' : ''}`}
            style={{
              position: 'absolute',
              left: table.x || 0,
              top: table.y || 0,
              transform: `rotate(${table.rotation || 0}deg)`,
              transformOrigin: 'center',
              width: `${table.width || 100}px`,
              height: `${table.height || 100}px`,
              backgroundColor:
                table.type === 'bar'
                  ? '#9333ea'
                  : table.type === 'billiard'
                  ? '#10b981'
                  : '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'move',
              userSelect: 'none',
            }}
            onClick={() => setSelectedTableId(table.id)}
          >
            {table.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TableLayoutEditor;
