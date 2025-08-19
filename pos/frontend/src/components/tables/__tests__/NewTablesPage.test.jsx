import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TableProvider, useTableContext } from '../../contexts/TableContext';
import NewTablesPage from '../NewTablesPage';

// Mock the components that are not relevant for this test
jest.mock('../table/TableLayoutEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-table-layout-editor" />
}));

// Mock data
const mockLayout = {
  id: '1',
  name: 'Main Floor',
  width: 2000,
  height: 2000,
  backgroundImage: null
};

const mockTables = [
  {
    id: 'table1',
    name: 'Table 1',
    type: 'bar',
    status: 'available',
    positionX: 100,
    positionY: 200,
    width: 100,
    height: 100,
    rotation: 0,
    capacity: 4
  }
];

const mockContext = {
  layout: mockLayout,
  tables: mockTables,
  layouts: [
    { id: '1', name: 'Main Floor', isActive: true },
    { id: '2', name: 'Patio', isActive: false },
  ],
  selectedTableId: null,
  activeLayoutId: '1',
  loading: false,
  error: null,
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

// Mock the useTableContext hook
jest.mock('../../contexts/TableContext', () => ({
  ...jest.requireActual('../../__mocks__/contexts/TableContext'),
  useTableContext: jest.fn(),
}));

describe('NewTablesPage', () => {
  // Setup mock context before each test
  beforeEach(() => {
    useTableContext.mockImplementation(() => ({
      layout: mockLayout,
      tables: mockTables,
      layouts: [
        { id: '1', name: 'Main Floor', isActive: true },
        { id: '2', name: 'Patio', isActive: false },
      ],
      selectedTableId: null,
      activeLayoutId: '1',
      loading: false,
      error: null,
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
    }));
  });

  const renderComponent = () => {
    return render(
      <TableProvider>
        <NewTablesPage />
      </TableProvider>
    );
  };

  it('renders the main container with sidebar and content', () => {
    renderComponent();
    
    // Check if the main container is rendered
    expect(screen.getByTestId('tables-page')).toBeInTheDocument();
    
    // Check if sidebar is rendered
    expect(screen.getByTestId('tables-sidebar')).toBeInTheDocument();
    
    // Check if the main content area is rendered
    expect(screen.getByTestId('tables-content')).toBeInTheDocument();
  });

  it('renders the layout editor when a layout is selected', () => {
    renderComponent();
    
    // The TableLayoutEditor should be rendered
    expect(screen.getByTestId('mock-table-layout-editor')).toBeInTheDocument();
  });

  it('renders the layout management controls', () => {
    renderComponent();
    
    // Check for layout management buttons
    expect(screen.getByText('New Layout')).toBeInTheDocument();
    expect(screen.getByText('Save Layout')).toBeInTheDocument();
    expect(screen.getByText('Delete Layout')).toBeInTheDocument();
  });

  it('renders the view controls', () => {
    renderComponent();
    
    // Check for view control buttons
    expect(screen.getByLabelText('Zoom In')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom Out')).toBeInTheDocument();
    expect(screen.getByLabelText('Fit to View')).toBeInTheDocument();
    expect(screen.getByLabelText('Center View')).toBeInTheDocument();
  });
});
