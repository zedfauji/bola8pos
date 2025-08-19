import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TableLayoutSelector from '../TableLayoutSelector';
import { useTableContext } from '../../../contexts/NewTableContext';

// Mock the context hooks
jest.mock('../../../contexts/NewTableContext');

describe('TableLayoutSelector', () => {
  // Mock data
  const mockLayouts = [
    { id: 'layout1', name: 'Main Floor', isActive: true },
    { id: 'layout2', name: 'Patio', isActive: false },
    { id: 'layout3', name: 'VIP Area', isActive: false }
  ];

  // Mock functions
  const mockSetActiveLayout = jest.fn();
  const mockCreateLayout = jest.fn();
  const mockUpdateLayout = jest.fn();
  const mockDeleteLayout = jest.fn();

  // Setup mocks before each test
  beforeEach(() => {
    // Mock table context
    useTableContext.mockReturnValue({
      layouts: mockLayouts,
      activeLayout: mockLayouts[0],
      setActiveLayout: mockSetActiveLayout,
      createLayout: mockCreateLayout,
      updateLayout: mockUpdateLayout,
      deleteLayout: mockDeleteLayout,
      loading: false
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the layout selector with all layouts', () => {
    render(<TableLayoutSelector />);
    
    // Check if all layouts are displayed
    expect(screen.getByText('Main Floor')).toBeInTheDocument();
    expect(screen.getByText('Patio')).toBeInTheDocument();
    expect(screen.getByText('VIP Area')).toBeInTheDocument();
  });

  it('highlights the active layout', () => {
    render(<TableLayoutSelector />);
    
    // Check if the active layout is highlighted
    const activeLayout = screen.getByText('Main Floor').closest('button');
    expect(activeLayout).toHaveClass('bg-primary');
  });

  it('changes the active layout when clicked', () => {
    render(<TableLayoutSelector />);
    
    // Click on a different layout
    fireEvent.click(screen.getByText('Patio'));
    
    // Check if setActiveLayout is called with the correct layout
    expect(mockSetActiveLayout).toHaveBeenCalledWith(mockLayouts[1]);
  });

  it('renders in compact mode when compact prop is true', () => {
    render(<TableLayoutSelector compact={true} />);
    
    // Check if the component is rendered in compact mode
    const layoutSelector = screen.getByTestId('layout-selector');
    expect(layoutSelector).toHaveClass('compact-mode');
  });

  it('opens the create layout dialog when add button is clicked', () => {
    render(<TableLayoutSelector />);
    
    // Click on the add layout button
    fireEvent.click(screen.getByLabelText('Add Layout'));
    
    // Check if the create layout dialog is displayed
    expect(screen.getByText('Create New Layout')).toBeInTheDocument();
  });

  it('creates a new layout when form is submitted', async () => {
    render(<TableLayoutSelector />);
    
    // Click on the add layout button
    fireEvent.click(screen.getByLabelText('Add Layout'));
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText('Layout Name'), { target: { value: 'New Layout' } });
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Height'), { target: { value: '800' } });
    
    // Submit the form
    fireEvent.click(screen.getByText('Create'));
    
    // Check if createLayout is called with the correct data
    await waitFor(() => {
      expect(mockCreateLayout).toHaveBeenCalledWith({
        name: 'New Layout',
        width: 1000,
        height: 800,
        backgroundImage: null
      });
    });
  });

  it('opens the edit layout dialog when edit button is clicked', () => {
    render(<TableLayoutSelector />);
    
    // Click on the edit button for the first layout
    const editButtons = screen.getAllByLabelText('Edit Layout');
    fireEvent.click(editButtons[0]);
    
    // Check if the edit layout dialog is displayed
    expect(screen.getByText('Edit Layout')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Main Floor')).toBeInTheDocument();
  });

  it('updates a layout when edit form is submitted', async () => {
    render(<TableLayoutSelector />);
    
    // Click on the edit button for the first layout
    const editButtons = screen.getAllByLabelText('Edit Layout');
    fireEvent.click(editButtons[0]);
    
    // Change the layout name
    fireEvent.change(screen.getByDisplayValue('Main Floor'), { target: { value: 'Updated Main Floor' } });
    
    // Submit the form
    fireEvent.click(screen.getByText('Save Changes'));
    
    // Check if updateLayout is called with the correct data
    await waitFor(() => {
      expect(mockUpdateLayout).toHaveBeenCalledWith({
        ...mockLayouts[0],
        name: 'Updated Main Floor'
      });
    });
  });

  it('confirms before deleting a layout', () => {
    render(<TableLayoutSelector />);
    
    // Click on the delete button for the first layout
    const deleteButtons = screen.getAllByLabelText('Delete Layout');
    fireEvent.click(deleteButtons[0]);
    
    // Check if the confirmation dialog is displayed
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete the layout "Main Floor"?')).toBeInTheDocument();
  });

  it('deletes a layout when confirmed', async () => {
    render(<TableLayoutSelector />);
    
    // Click on the delete button for the first layout
    const deleteButtons = screen.getAllByLabelText('Delete Layout');
    fireEvent.click(deleteButtons[0]);
    
    // Confirm deletion
    fireEvent.click(screen.getByText('Delete'));
    
    // Check if deleteLayout is called with the correct layout id
    await waitFor(() => {
      expect(mockDeleteLayout).toHaveBeenCalledWith('layout1');
    });
  });

  it('shows loading state when layouts are being fetched', () => {
    // Mock loading state
    useTableContext.mockReturnValue({
      layouts: [],
      loading: true
    });
    
    render(<TableLayoutSelector />);
    
    // Check if loading indicator is displayed
    expect(screen.getByText('Loading layouts...')).toBeInTheDocument();
  });

  it('shows empty state when no layouts are available', () => {
    // Mock empty layouts
    useTableContext.mockReturnValue({
      layouts: [],
      loading: false
    });
    
    render(<TableLayoutSelector />);
    
    // Check if empty state is displayed
    expect(screen.getByText('No layouts available')).toBeInTheDocument();
    expect(screen.getByText('Create a new layout to get started')).toBeInTheDocument();
  });
});
