import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SessionManager from '../SessionManager';
import { useTableContext } from '../../../contexts/NewTableContext';
import { useSocket } from '../../../contexts/SocketContext';
import { useToast } from '../../../hooks/use-toast';

// Mock the context hooks
jest.mock('../../../contexts/NewTableContext');
jest.mock('../../../contexts/SocketContext');
jest.mock('../../../hooks/use-toast');

describe('SessionManager', () => {
  // Mock data
  const mockTable = {
    id: 'table1',
    name: 'Table 1',
    status: 'available',
    type: 'pool',
    capacity: 4
  };

  const mockTableWithSession = {
    id: 'table2',
    name: 'Table 2',
    status: 'occupied',
    type: 'billiard',
    capacity: 6,
    currentSession: {
      id: 'session1',
      startTime: '2025-08-18T12:00:00Z',
      tariffName: 'Standard',
      currentAmount: 25.50,
      status: 'active'
    }
  };

  const mockTableWithPausedSession = {
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
  };

  const mockTariffs = [
    { id: 'tariff1', name: 'Standard', hourlyRate: 10.00 },
    { id: 'tariff2', name: 'Premium', hourlyRate: 15.00 },
    { id: 'tariff3', name: 'VIP', hourlyRate: 20.00 }
  ];

  // Mock functions
  const mockStartSession = jest.fn();
  const mockPauseSession = jest.fn();
  const mockResumeSession = jest.fn();
  const mockEndSession = jest.fn();
  const mockUpdateSession = jest.fn();
  const mockToast = jest.fn();
  const mockEmit = jest.fn();

  // Setup mocks before each test
  beforeEach(() => {
    // Mock table context
    useTableContext.mockReturnValue({
      tariffs: mockTariffs,
      startSession: mockStartSession,
      pauseSession: mockPauseSession,
      resumeSession: mockResumeSession,
      endSession: mockEndSession,
      updateSession: mockUpdateSession
    });

    // Mock socket context
    useSocket.mockReturnValue({
      socket: {
        emit: mockEmit
      },
      connected: true
    });

    // Mock toast
    useToast.mockReturnValue({
      toast: mockToast
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the session manager with available table', () => {
    render(<SessionManager table={mockTable} />);
    
    // Check if the component renders with the correct table name
    expect(screen.getByText(`Table: ${mockTable.name}`)).toBeInTheDocument();
    
    // Check if start session button is available
    expect(screen.getByText('Start Session')).toBeInTheDocument();
    
    // Check if tariff selection is available
    expect(screen.getByLabelText('Select Tariff')).toBeInTheDocument();
  });

  it('renders the session manager with active session', () => {
    render(<SessionManager table={mockTableWithSession} />);
    
    // Check if the component renders with the correct table name
    expect(screen.getByText(`Table: ${mockTableWithSession.name}`)).toBeInTheDocument();
    
    // Check if session details are displayed
    expect(screen.getByText('Current Session')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('$25.50')).toBeInTheDocument();
    
    // Check if pause and end session buttons are available
    expect(screen.getByText('Pause Session')).toBeInTheDocument();
    expect(screen.getByText('End Session')).toBeInTheDocument();
  });

  it('renders the session manager with paused session', () => {
    render(<SessionManager table={mockTableWithPausedSession} />);
    
    // Check if the component renders with the correct table name
    expect(screen.getByText(`Table: ${mockTableWithPausedSession.name}`)).toBeInTheDocument();
    
    // Check if session details are displayed
    expect(screen.getByText('Current Session (Paused)')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('$35.00')).toBeInTheDocument();
    
    // Check if resume and end session buttons are available
    expect(screen.getByText('Resume Session')).toBeInTheDocument();
    expect(screen.getByText('End Session')).toBeInTheDocument();
  });

  it('starts a session when start button is clicked', async () => {
    render(<SessionManager table={mockTable} />);
    
    // Select a tariff
    fireEvent.change(screen.getByLabelText('Select Tariff'), { target: { value: 'tariff1' } });
    
    // Click start session button
    fireEvent.click(screen.getByText('Start Session'));
    
    // Check if startSession is called with the correct parameters
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith('table1', 'tariff1');
    });
    
    // Check if toast notification is shown
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Session Started',
      description: 'Session started successfully for Table 1',
      status: 'success'
    });
  });

  it('pauses a session when pause button is clicked', async () => {
    render(<SessionManager table={mockTableWithSession} />);
    
    // Click pause session button
    fireEvent.click(screen.getByText('Pause Session'));
    
    // Check if pauseSession is called with the correct parameters
    await waitFor(() => {
      expect(mockPauseSession).toHaveBeenCalledWith('session1');
    });
    
    // Check if toast notification is shown
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Session Paused',
      description: 'Session paused for Table 2',
      status: 'info'
    });
  });

  it('resumes a session when resume button is clicked', async () => {
    render(<SessionManager table={mockTableWithPausedSession} />);
    
    // Click resume session button
    fireEvent.click(screen.getByText('Resume Session'));
    
    // Check if resumeSession is called with the correct parameters
    await waitFor(() => {
      expect(mockResumeSession).toHaveBeenCalledWith('session2');
    });
    
    // Check if toast notification is shown
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Session Resumed',
      description: 'Session resumed for Table 3',
      status: 'success'
    });
  });

  it('ends a session when end button is clicked', async () => {
    render(<SessionManager table={mockTableWithSession} />);
    
    // Click end session button
    fireEvent.click(screen.getByText('End Session'));
    
    // Check if confirmation dialog is shown
    expect(screen.getByText('End Session Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to end the current session?')).toBeInTheDocument();
    
    // Confirm ending the session
    fireEvent.click(screen.getByText('Confirm'));
    
    // Check if endSession is called with the correct parameters
    await waitFor(() => {
      expect(mockEndSession).toHaveBeenCalledWith('session1');
    });
    
    // Check if toast notification is shown
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Session Ended',
      description: 'Session ended successfully for Table 2',
      status: 'success'
    });
  });

  it('cancels ending a session when cancel button is clicked', async () => {
    render(<SessionManager table={mockTableWithSession} />);
    
    // Click end session button
    fireEvent.click(screen.getByText('End Session'));
    
    // Check if confirmation dialog is shown
    expect(screen.getByText('End Session Confirmation')).toBeInTheDocument();
    
    // Cancel ending the session
    fireEvent.click(screen.getByText('Cancel'));
    
    // Check if endSession is not called
    expect(mockEndSession).not.toHaveBeenCalled();
    
    // Check if confirmation dialog is closed
    await waitFor(() => {
      expect(screen.queryByText('End Session Confirmation')).not.toBeInTheDocument();
    });
  });

  it('shows error when starting session without selecting tariff', async () => {
    render(<SessionManager table={mockTable} />);
    
    // Click start session button without selecting a tariff
    fireEvent.click(screen.getByText('Start Session'));
    
    // Check if error toast is shown
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Please select a tariff before starting a session',
      status: 'error'
    });
    
    // Check if startSession is not called
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('shows session timer for active session', () => {
    // Mock Date.now to return a consistent value
    const mockDate = new Date('2025-08-18T14:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    
    render(<SessionManager table={mockTableWithSession} />);
    
    // Check if session timer is displayed
    expect(screen.getByText('Duration: 2:00:00')).toBeInTheDocument();
    
    // Restore Date
    global.Date = Date;
  });

  it('shows session cost calculation for active session', () => {
    render(<SessionManager table={mockTableWithSession} />);
    
    // Check if session cost is displayed
    expect(screen.getByText('$25.50')).toBeInTheDocument();
  });

  it('emits socket event when session status changes', async () => {
    render(<SessionManager table={mockTableWithSession} />);
    
    // Click pause session button
    fireEvent.click(screen.getByText('Pause Session'));
    
    // Check if socket emit is called
    await waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith('session:statusChange', {
        sessionId: 'session1',
        tableId: 'table2',
        status: 'paused'
      });
    });
  });
});
