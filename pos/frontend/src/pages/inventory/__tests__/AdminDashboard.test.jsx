import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SnackbarProvider } from 'notistack';
import { BrowserRouter } from 'react-router-dom';
import AdminDashboard from '../AdminDashboard';
import { inventoryService } from '../../../services/inventoryService';

// Mock the inventoryService
jest.mock('../../../services/inventoryService', () => ({
  inventoryService: {
    getLowStockItems: jest.fn(),
    getInventoryValue: jest.fn(),
    getPendingPurchaseOrders: jest.fn(),
    getRecentInventoryAdjustments: jest.fn(),
  },
  backupApi: {
    listBackups: jest.fn(),
  }
}));

describe('AdminDashboard', () => {
  const mockLowStockItems = [
    { id: 1, name: 'Product 1', currentStock: 5, minStockLevel: 10 },
    { id: 2, name: 'Product 2', currentStock: 3, minStockLevel: 15 }
  ];
  
  const mockInventoryValue = {
    totalValue: 5000,
    totalItems: 100,
    averageItemValue: 50
  };
  
  const mockPendingOrders = [
    { id: 1, supplier: 'Supplier 1', orderDate: '2023-01-01', status: 'pending', totalAmount: 500 },
    { id: 2, supplier: 'Supplier 2', orderDate: '2023-01-02', status: 'pending', totalAmount: 750 }
  ];
  
  const mockRecentAdjustments = [
    { id: 1, product: 'Product 1', adjustmentDate: '2023-01-01', quantity: 5, reason: 'Damaged' },
    { id: 2, product: 'Product 2', adjustmentDate: '2023-01-02', quantity: -3, reason: 'Inventory count' }
  ];
  
  const mockBackups = [
    {
      filename: 'backup-2023-01-01.json',
      createdAt: '2023-01-01T12:00:00Z',
      size: 1024,
      collections: ['products', 'inventory']
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock responses
    inventoryService.getLowStockItems.mockResolvedValue(mockLowStockItems);
    inventoryService.getInventoryValue.mockResolvedValue(mockInventoryValue);
    inventoryService.getPendingPurchaseOrders.mockResolvedValue(mockPendingOrders);
    inventoryService.getRecentInventoryAdjustments.mockResolvedValue(mockRecentAdjustments);
    inventoryService.backupApi.listBackups.mockResolvedValue(mockBackups);
  });

  const renderWithProviders = () => {
    return render(
      <BrowserRouter>
        <SnackbarProvider>
          <AdminDashboard />
        </SnackbarProvider>
      </BrowserRouter>
    );
  };

  test('renders all dashboard widgets', async () => {
    renderWithProviders();
    
    // Check for widget titles
    await waitFor(() => {
      expect(screen.getByText('Inventory Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Low Stock Items')).toBeInTheDocument();
      expect(screen.getByText('Inventory Value')).toBeInTheDocument();
      expect(screen.getByText('Pending Purchase Orders')).toBeInTheDocument();
      expect(screen.getByText('Recent Inventory Adjustments')).toBeInTheDocument();
      expect(screen.getByText('Backup Management')).toBeInTheDocument();
    });
  });

  test('fetches and displays low stock items', async () => {
    renderWithProviders();
    
    await waitFor(() => {
      expect(inventoryService.getLowStockItems).toHaveBeenCalled();
      expect(screen.getByText('Product 1')).toBeInTheDocument();
      expect(screen.getByText('Product 2')).toBeInTheDocument();
    });
  });

  test('fetches and displays inventory value', async () => {
    renderWithProviders();
    
    await waitFor(() => {
      expect(inventoryService.getInventoryValue).toHaveBeenCalled();
      expect(screen.getByText('$5,000.00')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  test('fetches and displays pending purchase orders', async () => {
    renderWithProviders();
    
    await waitFor(() => {
      expect(inventoryService.getPendingPurchaseOrders).toHaveBeenCalled();
      expect(screen.getByText('Supplier 1')).toBeInTheDocument();
      expect(screen.getByText('Supplier 2')).toBeInTheDocument();
    });
  });

  test('fetches and displays recent inventory adjustments', async () => {
    renderWithProviders();
    
    await waitFor(() => {
      expect(inventoryService.getRecentInventoryAdjustments).toHaveBeenCalled();
      expect(screen.getByText('Product 1')).toBeInTheDocument();
      expect(screen.getByText('Product 2')).toBeInTheDocument();
      expect(screen.getByText('Damaged')).toBeInTheDocument();
      expect(screen.getByText('Inventory count')).toBeInTheDocument();
    });
  });

  test('fetches and displays backups', async () => {
    renderWithProviders();
    
    await waitFor(() => {
      expect(inventoryService.backupApi.listBackups).toHaveBeenCalled();
      expect(screen.getByText('backup-2023-01-01.json')).toBeInTheDocument();
    });
  });

  test('handles API errors gracefully', async () => {
    // Setup error responses
    inventoryService.getLowStockItems.mockRejectedValue(new Error('API error'));
    inventoryService.getInventoryValue.mockRejectedValue(new Error('API error'));
    inventoryService.getPendingPurchaseOrders.mockRejectedValue(new Error('API error'));
    inventoryService.getRecentInventoryAdjustments.mockRejectedValue(new Error('API error'));
    inventoryService.backupApi.listBackups.mockRejectedValue(new Error('API error'));
    
    renderWithProviders();
    
    // Check that the component doesn't crash
    await waitFor(() => {
      expect(screen.getByText('Inventory Admin Dashboard')).toBeInTheDocument();
    });
  });
});
