import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock react-dnd
vi.mock('react-dnd', () => ({
  useDrop: () => [
    { isOver: false, canDrop: false },
    vi.fn() // drop ref
  ],
  useDrag: () => [
    { isDragging: false },
    vi.fn(), // drag ref
    vi.fn()  // drag preview
  ]
}));

// Mock the Table component
vi.mock('../Table', () => ({
  __esModule: true,
  default: ({ table }) => <div data-testid={`table-${table.id}`}>{table.name}</div>
}));

// Mock the constants
vi.mock('../../constants/dndTypes', () => ({
  ItemTypes: {
    TABLE: 'table'
  }
}));

// Mock the useWebSocket hook
vi.mock('../../hooks/useWebSocket', () => ({
  __esModule: true,
  default: () => ({
    send: vi.fn(),
    close: vi.fn()
  })
}));

// Mock react-query
const mockQueryClient = {
  invalidateQueries: vi.fn(),
  getQueryData: vi.fn(),
  setQueryData: vi.fn(),
  prefetchQuery: vi.fn(),
  prefetchInfiniteQuery: vi.fn(),
  getQueryCache: vi.fn(),
  isFetching: vi.fn(),
  isMutating: vi.fn(),
  clear: vi.fn(),
  resetQueries: vi.fn(),
  removeQueries: vi.fn(),
  cancelQueries: vi.fn(),
  executeQuery: vi.fn(),
  executeMutation: vi.fn(),
  executeQueryInstance: vi.fn(),
  executeMutationInstance: vi.fn(),
  fetchQuery: vi.fn(),
  fetchInfiniteQuery: vi.fn(),
  ensureQueryData: vi.fn(),
  getDefaultOptions: vi.fn(),
  getQueryDefaults: vi.fn(),
  getMutationDefaults: vi.fn(),
  setDefaultOptions: vi.fn(),
  setQueryDefaults: vi.fn(),
  setMutationDefaults: vi.fn(),
  defaultOptions: {},
  queryCache: {
    findAll: vi.fn(() => []),
    find: vi.fn(),
    subscribe: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
  mutationCache: {
    find: vi.fn(),
    findAll: vi.fn(() => []),
    subscribe: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
};

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQuery: () => ({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
    useMutation: () => ({
      mutate: vi.fn(),
      isLoading: false,
      error: null,
    }),
    useQueryClient: () => mockQueryClient,
    QueryClient: class {
      constructor() {
        return mockQueryClient;
      }
    },
    QueryClientProvider: ({ children }) => <div>{children}</div>,
  };
});

// Mock the API service
vi.mock('../../services/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

// Mock the useToast hook
vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
    toasts: [],
  }),
}));

// Import the component after setting up mocks
import TableLayoutEditor from '../TableLayoutEditor';
import { TableProvider } from '../../../contexts/TableContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('TableLayoutEditor', () => {
  const defaultProps = {
    layout: {
      id: '1',
      name: 'Main Floor',
      width: 2000,
      height: 2000,
      backgroundImage: null
    },
    tables: [
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
    ],
    onTableSelect: vi.fn(),
    onTableUpdate: vi.fn(),
    onTableCreate: vi.fn(),
    onTableDelete: vi.fn(),
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const renderWithProvider = (ui, options) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TableProvider>
          {ui}
        </TableProvider>
      </QueryClientProvider>,
      options
    );
  };

  it('renders without crashing', () => {
    renderWithProvider(<TableLayoutEditor {...defaultProps} />);
    // Check if the main container is rendered
    expect(screen.getByTestId('table-layout-editor')).toBeInTheDocument();
  });

  it('renders the correct number of tables', () => {
    renderWithProvider(<TableLayoutEditor {...defaultProps} />);
    // Check if all tables are rendered
    const tables = screen.getAllByTestId(/^table-/);
    expect(tables).toHaveLength(defaultProps.tables.length);
  });

  it('renders the layout with correct dimensions', () => {
    renderWithProvider(<TableLayoutEditor {...defaultProps} />);
    const layout = screen.getByTestId('table-layout-container');
    expect(layout).toHaveStyle({
      width: `${defaultProps.layout.width}px`,
      height: `${defaultProps.layout.height}px`
    });
  });

  it('calls onTableSelect when a table is clicked', () => {
    const onTableSelect = vi.fn();
    renderWithProvider(<TableLayoutEditor {...defaultProps} onTableSelect={onTableSelect} />);
    
    const table = screen.getByTestId('table-table1');
    fireEvent.click(table);
    
    expect(onTableSelect).toHaveBeenCalledWith(defaultProps.tables[0]);
  });
  
  it('handles empty tables array', () => {
    const props = {
      ...defaultProps,
      tables: []
    };
    renderWithProvider(<TableLayoutEditor {...props} />);
    
    // Should still render the container but with no tables
    expect(screen.getByTestId('table-layout-editor')).toBeInTheDocument();
    expect(screen.queryByTestId(/^table-/)).not.toBeInTheDocument();
  });
});
