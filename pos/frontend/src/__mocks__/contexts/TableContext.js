import React from 'react';

export const TableContext = React.createContext();

export const TableProvider = ({ children }) => {
  const value = {
    // Mock state
    layout: {
      id: '1',
      name: 'Main Floor',
      width: 2000,
      height: 2000,
      backgroundImage: null
    },
    tables: [],
    layouts: [
      { id: '1', name: 'Main Floor', isActive: true },
      { id: '2', name: 'Patio', isActive: false },
      { id: '3', name: 'VIP Area', isActive: false }
    ],
    selectedTableId: null,
    activeLayoutId: '1',
    loading: false,
    error: null,
    
    // Mock actions
    setSelectedTableId: jest.fn(),
    setActiveLayoutId: jest.fn(),
    updateTablePosition: jest.fn(),
    updateTableDimensions: jest.fn(),
    updateTableRotation: jest.fn(),
    updateTableStatus: jest.fn(),
    createTable: jest.fn(),
    updateTable: jest.fn(),
    deleteTable: jest.fn(),
    saveLayout: jest.fn(),
  };

  return (
    <TableContext.Provider value={value}>
      {children}
    </TableContext.Provider>
  );
};

export const useTableContext = () => {
  const context = React.useContext(TableContext);
  if (!context) {
    throw new Error('useTableContext must be used within a TableProvider');
  }
  return context;
};

export default TableContext;
