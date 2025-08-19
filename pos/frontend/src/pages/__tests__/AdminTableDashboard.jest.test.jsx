import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminTableDashboard from '../AdminTableDashboard';
import { useTableContext } from '../../contexts/NewTableContext';
import { useSocket } from '../../contexts/SocketContext';
import { useToast } from '../../hooks/use-toast';

// Mock the context hooks
jest.mock('../../contexts/NewTableContext');
jest.mock('../../contexts/SocketContext');
jest.mock('../../hooks/use-toast');
jest.mock('../../hoc/withRoleGuard', () => ({
  __esModule: true,
  withRoleGuard: (Component) => Component
}));

// Mock components
jest.mock('../../components/tables/TableLayoutSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-table-layout-selector">Table Layout Selector</div>
}));

jest.mock('../../components/tables/RevenueChart', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-revenue-chart">Revenue Chart</div>
}));

describe('AdminTableDashboard', () => {
  // Mock data
  const mockTables = [
    {
      id: 'table1',
      name: 'Table 1',
      status: 'available',
      type: 'pool',
      capacity: 4
    },
    {
      id: 'table2',
      name: 'Table 2',
      status: 'occupied',
      type: 'billiard',
      capacity: 6,
      currentSession: {
        id: 'session1',
        startTime: '2025-08-18T12:00:00Z',
        tariffName: 'Standard',
        currentAmount: 25.50
      }
    },
    {
      id: 'table3',
      name: 'Table 3',
      status: 'maintenance',
      type: 'snooker',
      capacity: 2
    }
  ];

  const mockActiveSessions = [
    {
      id: 'session1',
      tableId: 'table2',
      tableName: 'Table 2',
      startTime: '2025-08-18T12:00:00Z',
      duration: 120,
      tariffName: 'Standard',
      currentAmount: 25.50
    }
  ];

  const mockActivityLog = [
    {
      id: 1,
      type: 'status',
      tableName: 'Table 1',
      status: 'available',
      timestamp: '2025-08-18T11:55:00Z'
    },
    {
      id: 2,
      type: 'session',
      tableName: 'Table 2',
      sessionStatus: 'created',
      timestamp: '2025-08-18T12:00:00Z'
    }
  ];

  // Setup mocks before each test
  beforeEach(() => {
    // Mock table context
    useTableContext.mockReturnValue({
      tables: mockTables,
      fetchTables: jest.fn().mockResolvedValue(mockTables),
      activeLayout: { id: 'layout1', name: 'Main Floor' }
    });

    // Mock socket context
    useSocket.mockReturnValue({
      socket: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
      },
      connected: true
    });

    // Mock toast
    useToast.mockReturnValue({
      toast: jest.fn()
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the dashboard with all sections', () => {
    render(<AdminTableDashboard />);
    
    // Check if main sections are rendered
    expect(screen.getByText('Table Management Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Tables')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('calculates table statistics correctly', async () => {
    render(<AdminTableDashboard />);
    
    // Wait for stats to be calculated
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // Total tables
      expect(screen.getByText('1')).toBeInTheDocument(); // Available tables
      expect(screen.getByText('1')).toBeInTheDocument(); // Occupied tables
      expect(screen.getByText('1')).toBeInTheDocument(); // Maintenance tables
    });
  });

  it('displays active sessions', async () => {
    // Mock the state for active sessions
    jest.spyOn(React, 'useState').mockImplementationOnce(() => [mockActiveSessions, jest.fn()]);
    
    render(<AdminTableDashboard />);
    
    // Check if active sessions are displayed
    await waitFor(() => {
      expect(screen.getByText('Table 2')).toBeInTheDocument();
      expect(screen.getByText('Standard')).toBeInTheDocument();
    });
  });

  it('displays activity log entries', async () => {
    // Mock the state for activity log
    jest.spyOn(React, 'useState').mockImplementationOnce(() => [mockActivityLog, jest.fn()]);
    
    render(<AdminTableDashboard />);
    
    // Check if activity log entries are displayed
    await waitFor(() => {
      expect(screen.getByText('Table 1 is now available')).toBeInTheDocument();
      expect(screen.getByText('New session started on Table 2')).toBeInTheDocument();
    });
  });

  it('subscribes to socket events on mount', () => {
    const mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    };
    
    useSocket.mockReturnValue({
      socket: mockSocket,
      connected: true
    });
    
    render(<AdminTableDashboard />);
    
    // Check if socket event listeners are registered
    expect(mockSocket.on).toHaveBeenCalledWith('table:statusChanged', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('session:created', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('session:updated', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('session:ended', expect.any(Function));
  });

  it('unsubscribes from socket events on unmount', () => {
    const mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    };
    
    useSocket.mockReturnValue({
      socket: mockSocket,
      connected: true
    });
    
    const { unmount } = render(<AdminTableDashboard />);
    unmount();
    
    // Check if socket event listeners are removed
    expect(mockSocket.off).toHaveBeenCalledWith('table:statusChanged', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('session:created', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('session:updated', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('session:ended', expect.any(Function));
  });

  it('changes tab when tab trigger is clicked', () => {
    render(<AdminTableDashboard />);
    
    // Click on the Tables tab
    fireEvent.click(screen.getByText('Tables'));
    
    // Check if the Tables tab content is displayed
    expect(screen.getByTestId('tables-tab-content')).toBeInTheDocument();
    
    // Click on the Sessions tab
    fireEvent.click(screen.getByText('Sessions'));
    
    // Check if the Sessions tab content is displayed
    expect(screen.getByTestId('sessions-tab-content')).toBeInTheDocument();
  });

  it('fetches tables on mount', () => {
    const fetchTablesMock = jest.fn().mockResolvedValue(mockTables);
    useTableContext.mockReturnValue({
      tables: mockTables,
      fetchTables: fetchTablesMock,
      activeLayout: { id: 'layout1', name: 'Main Floor' }
    });
    
    render(<AdminTableDashboard />);
    
    // Check if fetchTables is called
    expect(fetchTablesMock).toHaveBeenCalled();
  });

  it('shows loading state when data is being fetched', () => {
    // Mock loading state
    jest.spyOn(React, 'useState').mockImplementationOnce(() => [true, jest.fn()]);
    
    render(<AdminTableDashboard />);
    
    // Check if loading indicator is displayed
    expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument();
  });
});
