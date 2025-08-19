import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SnackbarProvider } from 'notistack';
import { BackupManagementWidget } from '../AdminDashboard';
import { backupApi } from '../../../services/inventoryService';

// Mock the backupApi
jest.mock('../../../services/inventoryService', () => ({
  backupApi: {
    createBackup: jest.fn(),
    restoreBackup: jest.fn(),
    deleteBackup: jest.fn(),
  }
}));

describe('BackupManagementWidget', () => {
  const mockBackups = [
    {
      filename: 'backup-2023-01-01.json',
      createdAt: '2023-01-01T12:00:00Z',
      size: 1024,
      collections: ['products', 'inventory', 'categories']
    },
    {
      filename: 'backup-2023-01-02.json',
      createdAt: '2023-01-02T12:00:00Z',
      size: 2048,
      collections: ['products', 'inventory', 'categories', 'suppliers']
    }
  ];

  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithSnackbar = (component) => {
    return render(
      <SnackbarProvider>
        {component}
      </SnackbarProvider>
    );
  };

  test('renders backup list correctly', () => {
    renderWithSnackbar(<BackupManagementWidget backups={mockBackups} onRefresh={mockOnRefresh} />);
    
    // Check if the widget title is displayed
    expect(screen.getByText('Backup Management')).toBeInTheDocument();
    
    // Check if both backups are displayed
    expect(screen.getByText('backup-2023-01-01.json')).toBeInTheDocument();
    expect(screen.getByText('backup-2023-01-02.json')).toBeInTheDocument();
    
    // Check if file sizes are displayed
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  test('opens create backup dialog when create button is clicked', () => {
    renderWithSnackbar(<BackupManagementWidget backups={mockBackups} onRefresh={mockOnRefresh} />);
    
    // Click the create backup button
    fireEvent.click(screen.getByText('Create Backup'));
    
    // Check if the dialog is displayed
    expect(screen.getByText('Create New Backup')).toBeInTheDocument();
    expect(screen.getByText('Select collections to include in the backup:')).toBeInTheDocument();
  });

  test('opens restore dialog when restore button is clicked', () => {
    renderWithSnackbar(<BackupManagementWidget backups={mockBackups} onRefresh={mockOnRefresh} />);
    
    // Find and click the first restore button (using aria-label)
    const restoreButtons = screen.getAllByLabelText('Restore');
    fireEvent.click(restoreButtons[0]);
    
    // Check if the dialog is displayed
    expect(screen.getByText('Restore from Backup')).toBeInTheDocument();
    expect(screen.getByText('Select collections to restore:')).toBeInTheDocument();
  });

  test('calls createBackup when create form is submitted', async () => {
    backupApi.createBackup.mockResolvedValue({ success: true });
    
    renderWithSnackbar(<BackupManagementWidget backups={mockBackups} onRefresh={mockOnRefresh} />);
    
    // Open create dialog
    fireEvent.click(screen.getByText('Create Backup'));
    
    // Submit the form
    fireEvent.click(screen.getByText('Create'));
    
    // Check if createBackup was called
    await waitFor(() => {
      expect(backupApi.createBackup).toHaveBeenCalled();
    });
    
    // Check if onRefresh was called
    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  test('calls restoreBackup when restore form is submitted', async () => {
    backupApi.restoreBackup.mockResolvedValue({ success: true });
    
    renderWithSnackbar(<BackupManagementWidget backups={mockBackups} onRefresh={mockOnRefresh} />);
    
    // Open restore dialog
    const restoreButtons = screen.getAllByLabelText('Restore');
    fireEvent.click(restoreButtons[0]);
    
    // Submit the form
    fireEvent.click(screen.getByText('Restore'));
    
    // Check if restoreBackup was called
    await waitFor(() => {
      expect(backupApi.restoreBackup).toHaveBeenCalledWith(
        'backup-2023-01-01.json',
        expect.any(Object)
      );
    });
    
    // Check if onRefresh was called
    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  test('calls deleteBackup when delete button is clicked', async () => {
    backupApi.deleteBackup.mockResolvedValue({ success: true });
    
    renderWithSnackbar(<BackupManagementWidget backups={mockBackups} onRefresh={mockOnRefresh} />);
    
    // Find and click the first delete button (using aria-label)
    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);
    
    // Confirm deletion in the dialog
    fireEvent.click(screen.getByText('Delete'));
    
    // Check if deleteBackup was called
    await waitFor(() => {
      expect(backupApi.deleteBackup).toHaveBeenCalledWith('backup-2023-01-01.json');
    });
    
    // Check if onRefresh was called
    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  test('handles API errors gracefully', async () => {
    backupApi.createBackup.mockRejectedValue(new Error('API error'));
    
    renderWithSnackbar(<BackupManagementWidget backups={mockBackups} onRefresh={mockOnRefresh} />);
    
    // Open create dialog
    fireEvent.click(screen.getByText('Create Backup'));
    
    // Submit the form
    fireEvent.click(screen.getByText('Create'));
    
    // Check if error is handled (no crash)
    await waitFor(() => {
      expect(backupApi.createBackup).toHaveBeenCalled();
    });
  });
});
