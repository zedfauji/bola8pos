import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StaffTableDashboard from '../StaffTableDashboard';
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

jest.mock('../../components/tables/QuickSessionActions', () => ({
  __esModule: true,
  default: ({ table, onStartSession, onPauseSession, onEndSession }) => (
    <div data-testid="mock-quick-session-actions">
      <button onClick={() => onStartSession(table.id, 'tariff1')}>Start Session</button>
      <button onClick={() => onPauseSession(table.currentSession?.id)}>Pause Session</button>
      <button onClick={() => onEndSession(table.currentSession?.id)}>End Session</button>
    </div>
  )
}));

describe('StaffTableDashboard', () => {
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
      status: 'reserved',
      type: 'snooker',
      capacity: 2,
      currentSession: {
        id: 'session2',
        startTime: '2025-08-18T11:30:00Z',
        tariffName: 'Premium',
        currentAmount: 35.00,
        status: 'paused'
      }
    }
  ];

  // Mock functions
  const mockToast = jest.fn();
  const mockUpdateTableInList = jest.fn();
  const mockFetchTables = jest.fn().mockResolvedValue(mockTables);
  const mockSubscribe = jest.fn();
  const mockJoinRoom = jest.fn();
  const mockLeaveRoom = jest.fn();

  // Setup mocks before each test
  beforeEach(() => {
    // Mock table context
    useTableContext.mockReturnValue({
      tables: mockTables,
      fetchTables: mockFetchTables,
      updateTableInList: mockUpdateTableInList,
      activeLayout: { id: 'layout1', name: 'Main Floor' }
    });

    // Mock socket context
    useSocket.mockReturnValue({
      socket: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
      },
      connected: true,
      subscribe: mockSubscribe,
      joinRoom: mockJoinRoom,
      leaveRoom: mockLeaveRoom
    });

    // Mock toast
    useToast.mockReturnValue({
      toast: mockToast
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the dashboard with all tabs', () => {
    render(<StaffTableDashboard />);
    
    // Check if main sections are rendered
    expect(screen.getByText('Table Management')).toBeInTheDocument();
    expect(screen.getByText('Tables')).toBeInTheDocument();
    expect(screen.getByText('Session Management')).toBeInTheDocument();
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
  });

  it('displays table layout selector', () => {
    render(<StaffTableDashboard />);
    
    // Check if table layout selector is rendered
    expect(screen.getByTestId('mock-table-layout-selector')).toBeInTheDocument();
  });

  it('displays tables in the tables tab', async () => {
    render(<StaffTableDashboard />);
    
    // Check if tables are displayed
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeInTheDocument();
      expect(screen.getByText('Table 2')).toBeInTheDocument();
      expect(screen.getByText('Table 3')).toBeInTheDocument();
    });
  });

  it('filters tables based on search query', async () => {
    render(<StaffTableDashboard />);
    
    // Enter search query
    const searchInput = screen.getByPlaceholderText('Search tables...');
    fireEvent.change(searchInput, { target: { value: 'Table 1' } });
    
    // Check if only matching tables are displayed
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeInTheDocument();
      expect(screen.queryByText('Table 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Table 3')).not.toBeInTheDocument();
    });
  });

  it('selects a table and shows session management tab', async () => {
    render(<StaffTableDashboard />);
    
    // Click on a table
    const table1 = screen.getByText('Table 1').closest('.cursor-pointer');
    fireEvent.click(table1);
    
    // Check if session management tab is active and shows table details
    await waitFor(() => {
      expect(screen.getByText('Table: Table 1')).toBeInTheDocument();
      expect(screen.getByTestId('mock-quick-session-actions')).toBeInTheDocument();
    });
  });

  it('handles start session action', async () => {
    const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    
    render(<StaffTableDashboard />);
    
    // Select a table
    const table1 = screen.getByText('Table 1').closest('.cursor-pointer');
    fireEvent.click(table1);
    
    // Click start session button
    const startButton = screen.getByText('Start Session');
    fireEvent.click(startButton);
    
    // Check if toast is called and console log is called
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Session Started',
        description: 'The session has been started successfully',
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Starting session on table'));
    });
    
    mockConsoleLog.mockRestore();
  });

  it('handles pause session action', async () => {
    const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    
    render(<StaffTableDashboard />);
    
    // Select a table with active session
    const table2 = screen.getByText('Table 2').closest('.cursor-pointer');
    fireEvent.click(table2);
    
    // Click pause session button
    const pauseButton = screen.getByText('Pause Session');
    fireEvent.click(pauseButton);
    
    // Check if toast is called and console log is called
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Session Paused',
        description: 'The session has been paused',
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Pausing session'));
    });
    
    mockConsoleLog.mockRestore();
  });

  it('handles end session action', async () => {
    const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    
    render(<StaffTableDashboard />);
    
    // Select a table with active session
    const table2 = screen.getByText('Table 2').closest('.cursor-pointer');
    fireEvent.click(table2);
    
    // Click end session button
    const endButton = screen.getByText('End Session');
    fireEvent.click(endButton);
    
    // Check if toast is called and console log is called
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Session Ended',
        description: 'The session has been ended successfully',
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Ending session'));
    });
    
    mockConsoleLog.mockRestore();
  });

  it('subscribes to socket events on mount', () => {
    render(<StaffTableDashboard />);
    
    // Check if socket event listeners are registered
    expect(mockSubscribe).toHaveBeenCalledWith('table_updated', expect.any(Function));
    expect(mockSubscribe).toHaveBeenCalledWith('session_updated', expect.any(Function));
    expect(mockJoinRoom).toHaveBeenCalledWith('layout_layout1');
  });

  it('unsubscribes from socket events on unmount', () => {
    const { unmount } = render(<StaffTableDashboard />);
    unmount();
    
    // Check if room is left on unmount
    expect(mockLeaveRoom).toHaveBeenCalledWith('layout_layout1');
  });

  it('shows active sessions in the active sessions tab', async () => {
    render(<StaffTableDashboard />);
    
    // Click on the Active Sessions tab
    fireEvent.click(screen.getByText('Active Sessions'));
    
    // Check if active sessions are displayed
    await waitFor(() => {
      expect(screen.getByText('Table 2')).toBeInTheDocument();
      expect(screen.getByText('Standard')).toBeInTheDocument();
    });
  });

  it('shows loading state when data is being fetched', () => {
    // Mock loading state
    jest.spyOn(React, 'useState').mockImplementationOnce(() => [true, jest.fn()]);
    
    render(<StaffTableDashboard />);
    
    // Check if loading indicator is displayed
    expect(screen.getByText('Loading tables...')).toBeInTheDocument();
  });

  it('shows empty state when no tables match search', async () => {
    render(<StaffTableDashboard />);
    
    // Enter search query that won't match any tables
    const searchInput = screen.getByPlaceholderText('Search tables...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    // Check if empty state is displayed
    await waitFor(() => {
      expect(screen.getByText('No Tables Found')).toBeInTheDocument();
      expect(screen.getByText('No tables match your search criteria')).toBeInTheDocument();
    });
  });
});
