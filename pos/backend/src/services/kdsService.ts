import { AuthService } from './auth.service';
import { AntiTheftService } from './antiTheftService';
import { KDSOrder, Order, OrderItem, Employee } from '../models';

export interface KitchenStation {
  id: string;
  name: string;
  type: 'grill' | 'fryer' | 'salad' | 'drinks' | 'desserts' | 'general';
  active: boolean;
  currentOrders: string[];
  capacity: number;
  employeeId?: string;
  status: 'available' | 'busy' | 'maintenance';
}

export interface PreparationStep {
  id: string;
  name: string;
  estimatedTime: number; // in minutes
  completed: boolean;
  startedAt?: string;
  completedAt?: string;
  employeeId?: string;
  notes?: string;
}

export interface OrderPriority {
  level: 'low' | 'normal' | 'high' | 'urgent';
  reason?: string;
  customerType?: 'vip' | 'regular' | 'takeaway';
  waitTime: number; // minutes since order placed
}

export interface KitchenMetrics {
  totalOrders: number;
  averagePrepTime: number;
  onTimeOrders: number;
  delayedOrders: number;
  stationUtilization: Record<string, number>;
  topItems: Array<{ itemId: string; name: string; quantity: number; prepTime: number }>;
  bottlenecks: Array<{ stationId: string; stationName: string; reason: string; impact: number }>;
}

export class KDSService {
  private static instance: KDSService;
  private authService: AuthService;
  private antiTheftService: AntiTheftService;

  private kitchenStations: KitchenStation[] = [
    {
      id: 'grill_1',
      name: 'Grill Station 1',
      type: 'grill',
      active: true,
      currentOrders: [],
      capacity: 5,
      status: 'available'
    },
    {
      id: 'fryer_1',
      name: 'Fryer Station 1',
      type: 'fryer',
      active: true,
      currentOrders: [],
      capacity: 8,
      status: 'available'
    },
    {
      id: 'salad_1',
      name: 'Salad Station 1',
      type: 'salad',
      active: true,
      currentOrders: [],
      capacity: 6,
      status: 'available'
    },
    {
      id: 'drinks_1',
      name: 'Drinks Station 1',
      type: 'drinks',
      active: true,
      currentOrders: [],
      capacity: 10,
      status: 'available'
    }
  ];

  private constructor() {
    this.authService = AuthService.getInstance();
    this.antiTheftService = AntiTheftService.getInstance();
  }

  public static getInstance(): KDSService {
    if (!KDSService.instance) {
      KDSService.instance = new KDSService();
    }
    return KDSService.instance;
  }

  /**
   * Create KDS order from regular order
   */
  async createKDSOrder(
    order: Order,
    employeeId: string
  ): Promise<KDSOrder> {
    const kdsOrderId = `kds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine preparation steps for each item
    const preparationSteps: PreparationStep[] = [];
    for (const item of order.items) {
      const itemSteps = this.getPreparationStepsForItem(item);
      preparationSteps.push(...itemSteps);
    }

    // Calculate priority
    const priority = this.calculateOrderPriority(order);

    const kdsOrder: KDSOrder = {
      id: kdsOrderId,
      orderId: order.id,
      tableId: order.tableId,
      customerName: order.customerName,
      items: order.items,
      preparationSteps,
      priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      assignedTo: null,
      estimatedPrepTime: this.calculateEstimatedPrepTime(preparationSteps),
      actualPrepTime: null,
      startedAt: null,
      completedAt: null,
      notes: order.notes || '',
      specialInstructions: order.specialInstructions || []
    };

    // Assign to appropriate kitchen station
    await this.assignOrderToStation(kdsOrder);

    // Log KDS order creation
    await this.antiTheftService.logAction(
      employeeId,
      'kds_order_created',
      { kdsOrderId, orderId: order.id, priority: priority.level }
    );

    return kdsOrder;
  }

  /**
   * Get preparation steps for a specific item
   */
  private getPreparationStepsForItem(item: OrderItem): PreparationStep[] {
    const steps: PreparationStep[] = [];
    
    // Define preparation steps based on item category
    switch (item.category) {
      case 'Food':
        if (item.name.toLowerCase().includes('burger')) {
          steps.push(
            { id: `step_${Date.now()}_1`, name: 'Prepare patty', estimatedTime: 8, completed: false },
            { id: `step_${Date.now()}_2`, name: 'Grill patty', estimatedTime: 6, completed: false },
            { id: `step_${Date.now()}_3`, name: 'Assemble burger', estimatedTime: 3, completed: false }
          );
        } else if (item.name.toLowerCase().includes('fries')) {
          steps.push(
            { id: `step_${Date.now()}_1`, name: 'Cut potatoes', estimatedTime: 2, completed: false },
            { id: `step_${Date.now()}_2`, name: 'Fry potatoes', estimatedTime: 5, completed: false },
            { id: `step_${Date.now()}_3`, name: 'Season and serve', estimatedTime: 1, completed: false }
          );
        } else {
          steps.push(
            { id: `step_${Date.now()}_1`, name: 'Prepare ingredients', estimatedTime: 3, completed: false },
            { id: `step_${Date.now()}_2`, name: 'Cook item', estimatedTime: 5, completed: false },
            { id: `step_${Date.now()}_3`, name: 'Plate and garnish', estimatedTime: 2, completed: false }
          );
        }
        break;
      
      case 'Drinks':
        if (item.name.toLowerCase().includes('cocktail')) {
          steps.push(
            { id: `step_${Date.now()}_1`, name: 'Gather ingredients', estimatedTime: 1, completed: false },
            { id: `step_${Date.now()}_2`, name: 'Mix cocktail', estimatedTime: 3, completed: false },
            { id: `step_${Date.now()}_3`, name: 'Garnish and serve', estimatedTime: 1, completed: false }
          );
        } else {
          steps.push(
            { id: `step_${Date.now()}_1`, name: 'Prepare drink', estimatedTime: 2, completed: false },
            { id: `step_${Date.now()}_2`, name: 'Add ice and garnish', estimatedTime: 1, completed: false }
          );
        }
        break;
      
      default:
        steps.push(
          { id: `step_${Date.now()}_1`, name: 'Prepare item', estimatedTime: 3, completed: false }
        );
    }

    return steps;
  }

  /**
   * Calculate order priority
   */
  private calculateOrderPriority(order: Order): OrderPriority {
    const now = new Date();
    const orderTime = new Date(order.createdAt);
    const waitTime = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60));

    let level: OrderPriority['level'] = 'normal';
    let reason = '';

    // VIP customers get higher priority
    if (order.customerType === 'vip') {
      level = 'high';
      reason = 'VIP customer';
    }
    // Takeaway orders get higher priority
    else if (order.orderType === 'takeaway') {
      level = 'high';
      reason = 'Takeaway order';
    }
    // Long wait times increase priority
    else if (waitTime > 30) {
      level = 'urgent';
      reason = 'Long wait time';
    }
    else if (waitTime > 20) {
      level = 'high';
      reason = 'Extended wait time';
    }

    return {
      level,
      reason,
      customerType: order.customerType,
      waitTime
    };
  }

  /**
   * Calculate estimated preparation time
   */
  private calculateEstimatedPrepTime(steps: PreparationStep[]): number {
    return steps.reduce((total, step) => total + step.estimatedTime, 0);
  }

  /**
   * Assign order to kitchen station
   */
  private async assignOrderToStation(kdsOrder: KDSOrder): Promise<void> {
    // Find available station based on order type
    const availableStations = this.kitchenStations.filter(station => 
      station.active && 
      station.status === 'available' &&
      station.currentOrders.length < station.capacity
    );

    if (availableStations.length === 0) {
      // No available stations, add to waiting list
      kdsOrder.status = 'waiting';
      return;
    }

    // Assign to station with most capacity
    const bestStation = availableStations.reduce((best, current) => 
      current.capacity - current.currentOrders.length > best.capacity - best.currentOrders.length ? current : best
    );

    bestStation.currentOrders.push(kdsOrder.id);
    kdsOrder.assignedTo = bestStation.id;
    kdsOrder.status = 'assigned';

    // Update station status if needed
    if (bestStation.currentOrders.length >= bestStation.capacity * 0.8) {
      bestStation.status = 'busy';
    }
  }

  /**
   * Start order preparation
   */
  async startOrderPreparation(
    kdsOrderId: string,
    employeeId: string
  ): Promise<KDSOrder> {
    const kdsOrder = await this.getKDSOrder(kdsOrderId);
    if (!kdsOrder) {
      throw new Error('KDS order not found');
    }

    if (kdsOrder.status !== 'assigned') {
      throw new Error('Order is not assigned to a station');
    }

    // Update order status
    kdsOrder.status = 'in_progress';
    kdsOrder.startedAt = new Date().toISOString();

    // Start first preparation step
    if (kdsOrder.preparationSteps.length > 0) {
      const firstStep = kdsOrder.preparationSteps[0];
      firstStep.startedAt = new Date().toISOString();
      firstStep.employeeId = employeeId;
    }

    // Log preparation start
    await this.antiTheftService.logAction(
      employeeId,
      'kds_preparation_started',
      { kdsOrderId, orderId: kdsOrder.orderId }
    );

    return kdsOrder;
  }

  /**
   * Complete preparation step
   */
  async completePreparationStep(
    kdsOrderId: string,
    stepId: string,
    employeeId: string,
    notes?: string
  ): Promise<PreparationStep> {
    const kdsOrder = await this.getKDSOrder(kdsOrderId);
    if (!kdsOrder) {
      throw new Error('KDS order not found');
    }

    const step = kdsOrder.preparationSteps.find(s => s.id === stepId);
    if (!step) {
      throw new Error('Preparation step not found');
    }

    // Complete step
    step.completed = true;
    step.completedAt = new Date().toISOString();
    step.employeeId = employeeId;
    if (notes) step.notes = notes;

    // Check if all steps are completed
    const allStepsCompleted = kdsOrder.preparationSteps.every(s => s.completed);
    if (allStepsCompleted) {
      await this.completeOrder(kdsOrderId, employeeId);
    } else {
      // Start next step
      const nextStep = kdsOrder.preparationSteps.find(s => !s.completed);
      if (nextStep) {
        nextStep.startedAt = new Date().toISOString();
        nextStep.employeeId = employeeId;
      }
    }

    // Log step completion
    await this.antiTheftService.logAction(
      employeeId,
      'kds_step_completed',
      { kdsOrderId, stepId, stepName: step.name }
    );

    return step;
  }

  /**
   * Complete entire order
   */
  async completeOrder(
    kdsOrderId: string,
    employeeId: string
  ): Promise<KDSOrder> {
    const kdsOrder = await this.getKDSOrder(kdsOrderId);
    if (!kdsOrder) {
      throw new Error('KDS order not found');
    }

    // Calculate actual preparation time
    if (kdsOrder.startedAt) {
      const startTime = new Date(kdsOrder.startedAt);
      const endTime = new Date();
      kdsOrder.actualPrepTime = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    }

    kdsOrder.status = 'completed';
    kdsOrder.completedAt = new Date().toISOString();

    // Remove from station
    if (kdsOrder.assignedTo) {
      const station = this.kitchenStations.find(s => s.id === kdsOrder.assignedTo);
      if (station) {
        station.currentOrders = station.currentOrders.filter(id => id !== kdsOrderId);
        
        // Update station status
        if (station.currentOrders.length === 0) {
          station.status = 'available';
        } else if (station.currentOrders.length < station.capacity * 0.5) {
          station.status = 'available';
        }
      }
    }

    // Log order completion
    await this.antiTheftService.logAction(
      employeeId,
      'kds_order_completed',
      { kdsOrderId, orderId: kdsOrder.orderId, actualPrepTime: kdsOrder.actualPrepTime }
    );

    return kdsOrder;
  }

  /**
   * Get KDS order
   */
  async getKDSOrder(kdsOrderId: string): Promise<KDSOrder | null> {
    // Mock implementation - replace with Firestore query
    const mockKDSOrder: KDSOrder = {
      id: kdsOrderId,
      orderId: 'order_123',
      tableId: 'table_1',
      customerName: 'John Doe',
      items: [
        {
          id: 'item_1',
          name: 'Burger',
          quantity: 2,
          unitPrice: 15.99,
          category: 'Food',
          specialInstructions: ['No onions', 'Extra cheese']
        }
      ],
      preparationSteps: [
        {
          id: 'step_1',
          name: 'Prepare patty',
          estimatedTime: 8,
          completed: false
        }
      ],
      priority: { level: 'normal', waitTime: 15 },
      status: 'assigned',
      createdAt: new Date().toISOString(),
      assignedTo: 'grill_1',
      estimatedPrepTime: 17,
      actualPrepTime: null,
      startedAt: null,
      completedAt: null,
      notes: '',
      specialInstructions: []
    };

    return mockKDSOrder;
  }

  /**
   * Get all KDS orders by status
   */
  async getKDSOrdersByStatus(status: KDSOrder['status']): Promise<KDSOrder[]> {
    // Mock implementation - replace with Firestore query
    const mockOrders: KDSOrder[] = [
      {
        id: 'kds_1',
        orderId: 'order_123',
        tableId: 'table_1',
        customerName: 'John Doe',
        items: [
          {
            id: 'item_1',
            name: 'Burger',
            quantity: 2,
            unitPrice: 15.99,
            category: 'Food',
            specialInstructions: ['No onions']
          }
        ],
        preparationSteps: [
          {
            id: 'step_1',
            name: 'Prepare patty',
            estimatedTime: 8,
            completed: false
          }
        ],
        priority: { level: 'normal', waitTime: 15 },
        status: 'assigned',
        createdAt: new Date().toISOString(),
        assignedTo: 'grill_1',
        estimatedPrepTime: 17,
        actualPrepTime: null,
        startedAt: null,
        completedAt: null,
        notes: '',
        specialInstructions: []
      }
    ];

    return mockOrders.filter(order => order.status === status);
  }

  /**
   * Get kitchen station status
   */
  getKitchenStations(): KitchenStation[] {
    return [...this.kitchenStations];
  }

  /**
   * Update kitchen station status
   */
  async updateStationStatus(
    stationId: string,
    status: KitchenStation['status'],
    employeeId: string
  ): Promise<void> {
    const station = this.kitchenStations.find(s => s.id === stationId);
    if (!station) {
      throw new Error('Kitchen station not found');
    }

    const oldStatus = station.status;
    station.status = status;

    // Log status change
    await this.antiTheftService.logAction(
      employeeId,
      'kitchen_station_status_updated',
      { stationId, stationName: station.name, oldStatus, newStatus: status }
    );
  }

  /**
   * Get kitchen metrics
   */
  async getKitchenMetrics(
    startDate: string,
    endDate: string
  ): Promise<KitchenMetrics> {
    // Mock implementation - replace with actual metrics calculation
    const totalOrders = 45;
    const averagePrepTime = 18;
    const onTimeOrders = 38;
    const delayedOrders = 7;

    const stationUtilization: Record<string, number> = {};
    for (const station of this.kitchenStations) {
      stationUtilization[station.id] = Math.floor(Math.random() * 100);
    }

    const topItems = [
      { itemId: 'item_1', name: 'Burger', quantity: 25, prepTime: 17 },
      { itemId: 'item_2', name: 'Fries', quantity: 30, prepTime: 8 },
      { itemId: 'item_3', name: 'Beer', quantity: 40, prepTime: 2 }
    ];

    const bottlenecks = [
      { stationId: 'grill_1', stationName: 'Grill Station 1', reason: 'High order volume', impact: 0.8 },
      { stationId: 'fryer_1', stationName: 'Fryer Station 1', reason: 'Equipment maintenance', impact: 0.6 }
    ];

    return {
      totalOrders,
      averagePrepTime,
      onTimeOrders,
      delayedOrders,
      stationUtilization,
      topItems,
      bottlenecks
    };
  }

  /**
   * Reassign order to different station
   */
  async reassignOrder(
    kdsOrderId: string,
    newStationId: string,
    employeeId: string,
    reason: string
  ): Promise<void> {
    const kdsOrder = await this.getKDSOrder(kdsOrderId);
    if (!kdsOrder) {
      throw new Error('KDS order not found');
    }

    const newStation = this.kitchenStations.find(s => s.id === newStationId);
    if (!newStation) {
      throw new Error('New station not found');
    }

    // Remove from old station
    if (kdsOrder.assignedTo) {
      const oldStation = this.kitchenStations.find(s => s.id === kdsOrder.assignedTo);
      if (oldStation) {
        oldStation.currentOrders = oldStation.currentOrders.filter(id => id !== kdsOrderId);
      }
    }

    // Assign to new station
    kdsOrder.assignedTo = newStationId;
    newStation.currentOrders.push(kdsOrderId);

    // Log reassignment
    await this.antiTheftService.logAction(
      employeeId,
      'kds_order_reassigned',
      { kdsOrderId, oldStation: kdsOrder.assignedTo, newStation: newStationId, reason }
    );
  }
}
