import { AuthService } from './auth.service';
import { AntiTheftService } from './antiTheftService';
import { InventoryItem, InventoryMovement, Alert, Employee } from '../models';

export interface StockLevel {
  itemId: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  lastUpdated: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstocked';
}

export interface InventoryAlert {
  id: string;
  type: 'low_stock' | 'out_of_stock' | 'overstocked' | 'expiring_soon' | 'theft_suspicion';
  itemId: string;
  itemName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: string;
  requiresAction: boolean;
  status: 'active' | 'acknowledged' | 'resolved';
  assignedTo?: string;
}

export interface ReorderSuggestion {
  itemId: string;
  itemName: string;
  currentStock: number;
  suggestedQuantity: number;
  estimatedCost: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
}

export interface InventoryAnalytics {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  averageTurnover: number;
  topSellingItems: Array<{ itemId: string; name: string; quantity: number; revenue: number }>;
  slowMovingItems: Array<{ itemId: string; name: string; daysInStock: number; lastSale: string }>;
  categoryDistribution: Record<string, { count: number; value: number }>;
  theftRiskItems: Array<{ itemId: string; name: string; riskScore: number; reasons: string[] }>;
}

export class InventoryService {
  private static instance: InventoryService;
  private authService: AuthService;
  private antiTheftService: AntiTheftService;

  private constructor() {
    this.authService = AuthService.getInstance();
    this.antiTheftService = AntiTheftService.getInstance();
  }

  public static getInstance(): InventoryService {
    if (!InventoryService.instance) {
      InventoryService.instance = new InventoryService();
    }
    return InventoryService.instance;
  }

  /**
   * Add new inventory item
   */
  async addInventoryItem(
    itemData: {
      name: string;
      category: string;
      description: string;
      unitPrice: number;
      costPrice: number;
      initialStock: number;
      minStock: number;
      maxStock: number;
      supplier?: string;
      barcode?: string;
      sku?: string;
    },
    employeeId: string
  ): Promise<InventoryItem> {
    const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const inventoryItem: InventoryItem = {
      id: itemId,
      name: itemData.name,
      category: itemData.category,
      description: itemData.description,
      unitPrice: itemData.unitPrice,
      costPrice: itemData.costPrice,
      currentStock: itemData.initialStock,
      minStock: itemData.minStock,
      maxStock: itemData.maxStock,
      supplier: itemData.supplier,
      barcode: itemData.barcode,
      sku: itemData.sku,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: employeeId,
      lastUpdated: new Date().toISOString()
    };

    // Create initial stock movement
    await this.createStockMovement({
      itemId,
      type: 'initial_stock',
      quantity: itemData.initialStock,
      reason: 'Initial inventory setup',
      employeeId,
      reference: `Initial stock for ${itemData.name}`
    });

    // Log item creation
    await this.antiTheftService.logAction(
      employeeId,
      'inventory_item_created',
      { itemId, itemName: itemData.name, initialStock: itemData.initialStock }
    );

    return inventoryItem;
  }

  /**
   * Update inventory stock
   */
  async updateStock(
    itemId: string,
    quantity: number,
    type: 'sale' | 'restock' | 'adjustment' | 'damage' | 'theft' | 'transfer',
    reason: string,
    employeeId: string,
    reference?: string
  ): Promise<InventoryMovement> {
    const item = await this.getInventoryItem(itemId);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    // Calculate new stock level
    let newStock = item.currentStock;
    switch (type) {
      case 'sale':
        newStock -= quantity;
        break;
      case 'restock':
        newStock += quantity;
        break;
      case 'adjustment':
        newStock += quantity; // Can be positive or negative
        break;
      case 'damage':
      case 'theft':
        newStock -= quantity;
        break;
      case 'transfer':
        newStock += quantity; // Assuming transfer in
        break;
    }

    if (newStock < 0) {
      throw new Error('Insufficient stock for this operation');
    }

    // Update item stock
    item.currentStock = newStock;
    item.lastUpdated = new Date().toISOString();

    // Create stock movement record
    const movement = await this.createStockMovement({
      itemId,
      type,
      quantity,
      reason,
      employeeId,
      reference,
      previousStock: item.currentStock - quantity,
      newStock
    });

    // Check stock levels and create alerts if needed
    await this.checkStockLevels(item);

    // Log stock update
    await this.antiTheftService.logAction(
      employeeId,
      'inventory_stock_updated',
      { itemId, itemName: item.name, type, quantity, newStock, reason }
    );

    return movement;
  }

  /**
   * Create stock movement record
   */
  private async createStockMovement(data: {
    itemId: string;
    type: string;
    quantity: number;
    reason: string;
    employeeId: string;
    reference?: string;
    previousStock?: number;
    newStock?: number;
  }): Promise<InventoryMovement> {
    const movement: InventoryMovement = {
      id: `movement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      itemId: data.itemId,
      type: data.type as any,
      quantity: data.quantity,
      reason: data.reason,
      employeeId: data.employeeId,
      reference: data.reference,
      previousStock: data.previousStock,
      newStock: data.newStock,
      timestamp: new Date().toISOString()
    };

    // Save movement to database
    // await this.saveInventoryMovement(movement);

    return movement;
  }

  /**
   * Check stock levels and create alerts
   */
  private async checkStockLevels(item: InventoryItem): Promise<void> {
    let alertType: InventoryAlert['type'] | null = null;
    let severity: InventoryAlert['severity'] = 'low';
    let message = '';

    if (item.currentStock <= 0) {
      alertType = 'out_of_stock';
      severity = 'critical';
      message = `${item.name} is out of stock`;
    } else if (item.currentStock <= item.minStock) {
      alertType = 'low_stock';
      severity = item.currentStock <= item.minStock / 2 ? 'high' : 'medium';
      message = `${item.name} is running low on stock (${item.currentStock} remaining)`;
    } else if (item.currentStock > item.maxStock * 1.2) {
      alertType = 'overstocked';
      severity = 'medium';
      message = `${item.name} is overstocked (${item.currentStock} in stock)`;
    }

    if (alertType) {
      await this.createInventoryAlert({
        type: alertType,
        itemId: item.id,
        itemName: item.name,
        severity,
        message,
        details: {
          currentStock: item.currentStock,
          minStock: item.minStock,
          maxStock: item.maxStock
        }
      });
    }
  }

  /**
   * Create inventory alert
   */
  private async createInventoryAlert(alertData: {
    type: InventoryAlert['type'];
    itemId: string;
    itemName: string;
    severity: InventoryAlert['severity'];
    message: string;
    details: any;
  }): Promise<InventoryAlert> {
    const alert: InventoryAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...alertData,
      timestamp: new Date().toISOString(),
      requiresAction: alertData.severity === 'high' || alertData.severity === 'critical',
      status: 'active'
    };

    // Save alert
    // await this.saveInventoryAlert(alert);

    // Log alert creation
    await this.antiTheftService.logAction(
      'system',
      'inventory_alert_created',
      { alertType: alertData.type, itemId: alertData.itemId, severity: alertData.severity }
    );

    return alert;
  }

  /**
   * Get inventory item
   */
  async getInventoryItem(itemId: string): Promise<InventoryItem | null> {
    // Mock implementation - replace with Firestore query
    const mockItem: InventoryItem = {
      id: itemId,
      name: 'Sample Item',
      category: 'Food',
      description: 'Sample description',
      unitPrice: 15.99,
      costPrice: 8.50,
      currentStock: 25,
      minStock: 10,
      maxStock: 100,
      supplier: 'Sample Supplier',
      barcode: '123456789',
      sku: 'SAMPLE-001',
      active: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      createdBy: 'employee_123',
      lastUpdated: new Date().toISOString()
    };

    return mockItem;
  }

  /**
   * Get all inventory items
   */
  async getAllInventoryItems(): Promise<InventoryItem[]> {
    // Mock implementation - replace with Firestore query
    const mockItems: InventoryItem[] = [
      {
        id: 'item_1',
        name: 'Burger',
        category: 'Food',
        description: 'Delicious burger',
        unitPrice: 15.99,
        costPrice: 8.50,
        currentStock: 25,
        minStock: 10,
        maxStock: 100,
        supplier: 'Food Supplier',
        barcode: '123456789',
        sku: 'BURGER-001',
        active: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'employee_123',
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'item_2',
        name: 'Beer',
        category: 'Drinks',
        description: 'Cold beer',
        unitPrice: 8.99,
        costPrice: 4.50,
        currentStock: 50,
        minStock: 20,
        maxStock: 200,
        supplier: 'Beverage Supplier',
        barcode: '987654321',
        sku: 'BEER-001',
        active: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'employee_123',
        lastUpdated: new Date().toISOString()
      }
    ];

    return mockItems;
  }

  /**
   * Get stock levels for all items
   */
  async getStockLevels(): Promise<StockLevel[]> {
    const items = await this.getAllInventoryItems();
    
    return items.map(item => {
      let status: StockLevel['status'] = 'in_stock';
      
      if (item.currentStock <= 0) {
        status = 'out_of_stock';
      } else if (item.currentStock <= item.minStock) {
        status = 'low_stock';
      } else if (item.currentStock > item.maxStock * 1.2) {
        status = 'overstocked';
      }

      return {
        itemId: item.id,
        currentStock: item.currentStock,
        minStock: item.minStock,
        maxStock: item.maxStock,
        reorderPoint: item.minStock + (item.maxStock - item.minStock) * 0.2,
        lastUpdated: item.lastUpdated,
        status
      };
    });
  }

  /**
   * Get inventory movements
   */
  async getInventoryMovements(
    filters: {
      itemId?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      employeeId?: string;
    }
  ): Promise<InventoryMovement[]> {
    // Mock implementation - replace with Firestore query
    const mockMovements: InventoryMovement[] = [
      {
        id: 'movement_1',
        itemId: 'item_1',
        type: 'sale',
        quantity: 2,
        reason: 'Customer order',
        employeeId: 'employee_123',
        reference: 'Order #123',
        previousStock: 27,
        newStock: 25,
        timestamp: new Date().toISOString()
      },
      {
        id: 'movement_2',
        itemId: 'item_2',
        type: 'restock',
        quantity: 10,
        reason: 'Weekly restock',
        employeeId: 'employee_123',
        reference: 'Restock #456',
        previousStock: 40,
        newStock: 50,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    return mockMovements.filter(movement => {
      if (filters.itemId && movement.itemId !== filters.itemId) return false;
      if (filters.type && movement.type !== filters.type) return false;
      if (filters.startDate && movement.timestamp < filters.startDate) return false;
      if (filters.endDate && movement.timestamp > filters.endDate) return false;
      if (filters.employeeId && movement.employeeId !== filters.employeeId) return false;
      return true;
    });
  }

  /**
   * Get reorder suggestions
   */
  async getReorderSuggestions(): Promise<ReorderSuggestion[]> {
    const stockLevels = await this.getStockLevels();
    const suggestions: ReorderSuggestion[] = [];

    for (const stock of stockLevels) {
      if (stock.status === 'low_stock' || stock.status === 'out_of_stock') {
        const item = await this.getInventoryItem(stock.itemId);
        if (!item) continue;

        const suggestedQuantity = stock.maxStock - stock.currentStock;
        const estimatedCost = suggestedQuantity * item.costPrice;
        
        let urgency: ReorderSuggestion['urgency'] = 'low';
        if (stock.status === 'out_of_stock') urgency = 'critical';
        else if (stock.currentStock <= stock.minStock / 2) urgency = 'high';
        else urgency = 'medium';

        suggestions.push({
          itemId: stock.itemId,
          itemName: item.name,
          currentStock: stock.currentStock,
          suggestedQuantity,
          estimatedCost,
          urgency,
          reason: stock.status === 'out_of_stock' ? 'Out of stock' : 'Below reorder point'
        });
      }
    }

    return suggestions.sort((a, b) => {
      const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    });
  }

  /**
   * Get inventory analytics
   */
  async getInventoryAnalytics(
    startDate: string,
    endDate: string
  ): Promise<InventoryAnalytics> {
    const items = await this.getAllInventoryItems();
    const movements = await this.getInventoryMovements({ startDate, endDate });

    // Calculate analytics
    const totalItems = items.length;
    const totalValue = items.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0);
    const lowStockItems = items.filter(item => item.currentStock <= item.minStock).length;
    const outOfStockItems = items.filter(item => item.currentStock <= 0).length;

    // Calculate average turnover (simplified)
    const averageTurnover = movements.length > 0 ? 
      movements.reduce((sum, m) => sum + Math.abs(m.quantity), 0) / movements.length : 0;

    // Top selling items (based on sales movements)
    const salesMovements = movements.filter(m => m.type === 'sale');
    const itemSales = new Map<string, { quantity: number; revenue: number }>();
    
    for (const movement of salesMovements) {
      const item = items.find(i => i.id === movement.itemId);
      if (!item) continue;

      const existing = itemSales.get(movement.itemId) || { quantity: 0, revenue: 0 };
      existing.quantity += movement.quantity;
      existing.revenue += movement.quantity * item.unitPrice;
      itemSales.set(movement.itemId, existing);
    }

    const topSellingItems = Array.from(itemSales.entries())
      .map(([itemId, sales]) => {
        const item = items.find(i => i.id === itemId);
        return {
          itemId,
          name: item?.name || 'Unknown',
          quantity: sales.quantity,
          revenue: sales.revenue
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Mock other analytics
    const categoryDistribution: Record<string, { count: number; value: number }> = {};
    for (const item of items) {
      if (!categoryDistribution[item.category]) {
        categoryDistribution[item.category] = { count: 0, value: 0 };
      }
      categoryDistribution[item.category].count++;
      categoryDistribution[item.category].value += item.currentStock * item.costPrice;
    }

    return {
      totalItems,
      totalValue,
      lowStockItems,
      outOfStockItems,
      averageTurnover,
      topSellingItems,
      slowMovingItems: [], // Would calculate based on last sale dates
      categoryDistribution,
      theftRiskItems: [] // Would calculate based on discrepancies and patterns
    };
  }

  /**
   * Get active inventory alerts
   */
  async getActiveAlerts(): Promise<InventoryAlert[]> {
    // Mock implementation - replace with Firestore query
    const mockAlerts: InventoryAlert[] = [
      {
        id: 'alert_1',
        type: 'low_stock',
        itemId: 'item_1',
        itemName: 'Burger',
        severity: 'medium',
        message: 'Burger is running low on stock (5 remaining)',
        details: { currentStock: 5, minStock: 10, maxStock: 100 },
        timestamp: new Date().toISOString(),
        requiresAction: true,
        status: 'active'
      }
    ];

    return mockAlerts.filter(alert => alert.status === 'active');
  }

  /**
   * Acknowledge inventory alert
   */
  async acknowledgeAlert(
    alertId: string,
    employeeId: string,
    notes?: string
  ): Promise<void> {
    // Get alert and update status
    // const alert = await this.getInventoryAlert(alertId);
    // if (alert) {
    //   alert.status = 'acknowledged';
    //   alert.assignedTo = employeeId;
    //   await this.saveInventoryAlert(alert);
    // }

    // Log acknowledgment
    await this.antiTheftService.logAction(
      employeeId,
      'inventory_alert_acknowledged',
      { alertId, notes }
    );
  }
}
