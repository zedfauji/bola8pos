import { randomUUID } from 'crypto'
import { getDb } from '../config/firebaseNode'
import { Order, OrderItem, Combo, ComboOrder, KDSOrder, COLLECTIONS } from '../models'
import { authService } from './auth.service'
import { tableService } from './tableService'

export interface CreateOrderRequest {
  tableId: number
  customerId?: string
  items: Array<{
    name: string
    price: number
    quantity: number
    modifiers?: string[]
    notes?: string
  }>
  combos?: Array<{
    comboId: string
    quantity: number
  }>
  notes?: string
  priority?: boolean
  employeeId: string
  accessCode: string
  ipAddress: string
}

export interface ApplyComboRequest {
  orderId: string
  comboId: string
  employeeId: string
  accessCode: string
  ipAddress: string
}

export interface VoidItemRequest {
  orderId: string
  itemId: string
  reason: string
  employeeId: string
  accessCode: string
  ipAddress: string
}

export interface OrderSummary {
  id: string
  tableId: number
  tableName: string
  customerName?: string
  items: OrderItem[]
  combos: ComboOrder[]
  subtotal: number
  discount: number
  total: number
  billiardTimeCredit?: number
  status: string
  priority: boolean
  createdAt: number
  employeeName: string
}

export class OrderService {
  private static instance: OrderService

  static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService()
    }
    return OrderService.instance
  }

  async createOrder(request: CreateOrderRequest): Promise<{ success: boolean; order?: Order; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(
        request.employeeId,
        request.accessCode,
        request.ipAddress
      )

      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(request.employeeId, 'order_management')) {
        return { success: false, message: 'Insufficient permissions for order management.' }
      }

      const db = getDb()

      // Check if table is occupied
      const tableStatus = await tableService.getTableStatus(request.tableId)
      if (!tableStatus || tableStatus.status !== 'occupied') {
        return { success: false, message: 'Table is not occupied.' }
      }

      // Calculate order totals
      let subtotal = 0
      let billiardTimeCredit = 0

      // Process regular items
      const orderItems: OrderItem[] = request.items.map(item => {
        const itemTotal = item.price * item.quantity
        subtotal += itemTotal
        
        return {
          id: randomUUID(),
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          modifiers: item.modifiers || [],
          notes: item.notes
        }
      })

      // Process combos
      const comboOrders: ComboOrder[] = []
      if (request.combos && request.combos.length > 0) {
        for (const comboRequest of request.combos) {
          const comboDoc = await db.collection(COLLECTIONS.COMBOS).doc(comboRequest.comboId).get()
          if (comboDoc.exists) {
            const combo = comboDoc.data() as Combo
            if (combo.active) {
              const comboTotal = combo.price * comboRequest.quantity
              subtotal += comboTotal
              billiardTimeCredit += combo.billiardTimeCredit * comboRequest.quantity

              comboOrders.push({
                comboId: combo.id,
                name: combo.name,
                discount: combo.discount,
                billiardTimeCredit: combo.billiardTimeCredit,
                appliedAt: Date.now()
              })
            }
          }
        }
      }

      // Calculate final total
      const discount = 0 // Could be calculated based on loyalty, promotions, etc.
      const total = subtotal - discount

      // Create order
      const orderId = randomUUID()
      const now = Date.now()
      
      const order: Order = {
        id: orderId,
        tableId: request.tableId,
        customerId: request.customerId,
        items: orderItems,
        combos: comboOrders,
        total,
        discount,
        billiardTimeCredit,
        status: 'pending',
        priority: request.priority || false,
        notes: request.notes,
        createdAt: now,
        updatedAt: now,
        employeeId: request.employeeId,
        accessCode: request.accessCode
      }

      // Save order to database
      await db.collection(COLLECTIONS.ORDERS).doc(orderId).set(order)

      // Create KDS order
      await this.createKDSOrder(orderId, request.tableId, orderItems, request.priority || false)

      // Log the order creation
      await authService.logAudit('ORDER_CREATED', request.employeeId, {
        orderId,
        tableId: request.tableId,
        customerId: request.customerId,
        items: request.items.length,
        combos: request.combos?.length || 0,
        total,
        billiardTimeCredit,
        ipAddress: request.ipAddress,
        accessCode: request.accessCode
      })

      return { success: true, order }

    } catch (error) {
      console.error('Create order error:', error)
      return { success: false, message: 'Failed to create order. Please try again.' }
    }
  }

  async applyCombo(request: ApplyComboRequest): Promise<{ success: boolean; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(
        request.employeeId,
        request.accessCode,
        request.ipAddress
      )

      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(request.employeeId, 'order_management')) {
        return { success: false, message: 'Insufficient permissions for order management.' }
      }

      const db = getDb()

      // Get order
      const orderDoc = await db.collection(COLLECTIONS.ORDERS).doc(request.orderId).get()
      if (!orderDoc.exists) {
        return { success: false, message: 'Order not found.' }
      }

      const order = orderDoc.data() as Order

      // Get combo
      const comboDoc = await db.collection(COLLECTIONS.COMBOS).doc(request.comboId).get()
      if (!comboDoc.exists) {
        return { success: false, message: 'Combo not found.' }
      }

      const combo = comboDoc.data() as Combo
      if (!combo.active) {
        return { success: false, message: 'Combo is not active.' }
      }

      // Check if combo already applied
      const existingCombo = order.combos.find(c => c.comboId === request.comboId)
      if (existingCombo) {
        return { success: false, message: 'Combo already applied to this order.' }
      }

      // Add combo to order
      const comboOrder: ComboOrder = {
        comboId: combo.id,
        name: combo.name,
        discount: combo.discount,
        billiardTimeCredit: combo.billiardTimeCredit,
        appliedAt: Date.now()
      }

      order.combos.push(comboOrder)
      order.total += combo.price - combo.discount
      order.billiardTimeCredit = (order.billiardTimeCredit || 0) + combo.billiardTimeCredit
      order.updatedAt = Date.now()

      // Update order
      await db.collection(COLLECTIONS.ORDERS).doc(request.orderId).update({
        combos: order.combos,
        total: order.total,
        billiardTimeCredit: order.billiardTimeCredit,
        updatedAt: order.updatedAt
      })

      // Log the combo application
      await authService.logAudit('COMBO_APPLIED', request.employeeId, {
        orderId: request.orderId,
        comboId: request.comboId,
        comboName: combo.name,
        discount: combo.discount,
        billiardTimeCredit: combo.billiardTimeCredit,
        ipAddress: request.ipAddress,
        accessCode: request.accessCode
      })

      return { success: true }

    } catch (error) {
      console.error('Apply combo error:', error)
      return { success: false, message: 'Failed to apply combo. Please try again.' }
    }
  }

  async voidItem(request: VoidItemRequest): Promise<{ success: boolean; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(
        request.employeeId,
        request.accessCode,
        request.ipAddress
      )

      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      // Check if employee has void approval permission
      if (!authService.hasPermission(request.employeeId, 'void_approval')) {
        return { success: false, message: 'Insufficient permissions for voiding items.' }
      }

      const db = getDb()

      // Get order
      const orderDoc = await db.collection(COLLECTIONS.ORDERS).doc(request.orderId).get()
      if (!orderDoc.exists) {
        return { success: false, message: 'Order not found.' }
      }

      const order = orderDoc.data() as Order

      // Find item to void
      const itemIndex = order.items.findIndex(item => item.id === request.itemId)
      if (itemIndex === -1) {
        return { success: false, message: 'Item not found in order.' }
      }

      const item = order.items[itemIndex]
      if (item.voided) {
        return { success: false, message: 'Item is already voided.' }
      }

      // Void the item
      order.items[itemIndex] = {
        ...item,
        voided: true,
        voidReason: request.reason,
        voidedBy: request.employeeId,
        voidedAt: Date.now()
      }

      // Recalculate order total
      order.total = order.items.reduce((sum, item) => {
        if (!item.voided) {
          return sum + (item.price * item.quantity)
        }
        return sum
      }, 0)

      // Add combo totals back
      order.total += order.combos.reduce((sum, combo) => sum + combo.discount, 0)

      order.updatedAt = Date.now()

      // Update order
      await db.collection(COLLECTIONS.ORDERS).doc(request.orderId).update({
        items: order.items,
        total: order.total,
        updatedAt: order.updatedAt
      })

      // Log the void
      await authService.logAudit('ITEM_VOIDED', request.employeeId, {
        orderId: request.orderId,
        itemId: request.itemId,
        itemName: item.name,
        reason: request.reason,
        amount: item.price * item.quantity,
        ipAddress: request.ipAddress,
        accessCode: request.accessCode
      })

      return { success: true }

    } catch (error) {
      console.error('Void item error:', error)
      return { success: false, message: 'Failed to void item. Please try again.' }
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const db = getDb()
      const orderDoc = await db.collection(COLLECTIONS.ORDERS).doc(orderId).get()
      
      if (!orderDoc.exists) {
        return null
      }

      return orderDoc.data() as Order

    } catch (error) {
      console.error('Get order error:', error)
      return null
    }
  }

  async getOrdersByTable(tableId: number): Promise<Order[]> {
    try {
      const db = getDb()
      const ordersSnapshot = await db.collection(COLLECTIONS.ORDERS)
        .where('tableId', '==', tableId)
        .orderBy('createdAt', 'desc')
        .get()

      const orders: Order[] = []
      ordersSnapshot.forEach(doc => {
        orders.push(doc.data() as Order)
      })

      return orders

    } catch (error) {
      console.error('Get orders by table error:', error)
      return []
    }
  }

  async getOrderSummary(orderId: string): Promise<OrderSummary | null> {
    try {
      const order = await this.getOrder(orderId)
      if (!order) {
        return null
      }

      // Get table info
      const tableStatus = await tableService.getTableStatus(order.tableId)
      if (!tableStatus) {
        return null
      }

      // Get employee info
      const employee = authService.getCachedEmployee(order.employeeId)
      const employeeName = employee?.name || 'Unknown'

      // Get customer name
      let customerName: string | undefined
      if (order.customerId) {
        const db = getDb()
        const customerDoc = await db.collection(COLLECTIONS.CUSTOMERS).doc(order.customerId).get()
        if (customerDoc.exists) {
          const customer = customerDoc.data()
          customerName = customer.name
        }
      }

      return {
        id: order.id,
        tableId: order.tableId,
        tableName: tableStatus.name,
        customerName,
        items: order.items,
        combos: order.combos,
        subtotal: order.total + order.discount,
        discount: order.discount,
        total: order.total,
        billiardTimeCredit: order.billiardTimeCredit,
        status: order.status,
        priority: order.priority,
        createdAt: order.createdAt,
        employeeName
      }

    } catch (error) {
      console.error('Get order summary error:', error)
      return null
    }
  }

  async updateOrderStatus(orderId: string, status: string, employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'order_management')) {
        return { success: false, message: 'Insufficient permissions for order management.' }
      }

      const db = getDb()

      // Update order status
      await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
        status,
        updatedAt: Date.now()
      })

      // Update KDS order status
      await this.updateKDSOrderStatus(orderId, status)

      // Log the status update
      await authService.logAudit('ORDER_STATUS_UPDATED', employeeId, {
        orderId,
        status,
        ipAddress,
        accessCode
      })

      return { success: true }

    } catch (error) {
      console.error('Update order status error:', error)
      return { success: false, message: 'Failed to update order status. Please try again.' }
    }
  }

  private async createKDSOrder(orderId: string, tableId: number, items: OrderItem[], priority: boolean): Promise<void> {
    try {
      const db = getDb()
      const kdsOrderId = randomUUID()
      
      const kdsOrder: KDSOrder = {
        id: kdsOrderId,
        orderId,
        tableId,
        items,
        status: 'pending',
        priority,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      await db.collection(COLLECTIONS.KDS_ORDERS).doc(kdsOrderId).set(kdsOrder)

    } catch (error) {
      console.error('Create KDS order error:', error)
    }
  }

  private async updateKDSOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      const db = getDb()
      const kdsOrdersSnapshot = await db.collection(COLLECTIONS.KDS_ORDERS)
        .where('orderId', '==', orderId)
        .limit(1)
        .get()

      if (!kdsOrdersSnapshot.empty) {
        const kdsOrderDoc = kdsOrdersSnapshot.docs[0]
        await kdsOrderDoc.ref.update({
          status,
          updatedAt: Date.now()
        })
      }

    } catch (error) {
      console.error('Update KDS order status error:', error)
    }
  }

  async getKDSOrders(): Promise<KDSOrder[]> {
    try {
      const db = getDb()
      const kdsOrdersSnapshot = await db.collection(COLLECTIONS.KDS_ORDERS)
        .where('status', 'in', ['pending', 'in_progress'])
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'asc')
        .get()

      const kdsOrders: KDSOrder[] = []
      kdsOrdersSnapshot.forEach(doc => {
        kdsOrders.push(doc.data() as KDSOrder)
      })

      return kdsOrders

    } catch (error) {
      console.error('Get KDS orders error:', error)
      return []
    }
  }

  async assignKDSOrder(kdsOrderId: string, employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'kds_management')) {
        return { success: false, message: 'Insufficient permissions for KDS management.' }
      }

      const db = getDb()

      // Update KDS order assignment
      await db.collection(COLLECTIONS.KDS_ORDERS).doc(kdsOrderId).update({
        assignedTo: employeeId,
        updatedAt: Date.now()
      })

      // Log the assignment
      await authService.logAudit('KDS_ORDER_ASSIGNED', employeeId, {
        kdsOrderId,
        ipAddress,
        accessCode
      })

      return { success: true }

    } catch (error) {
      console.error('Assign KDS order error:', error)
      return { success: false, message: 'Failed to assign KDS order. Please try again.' }
    }
  }

  async getComboSuggestions(tableId: number): Promise<Combo[]> {
    try {
      const db = getDb()
      const combosSnapshot = await db.collection(COLLECTIONS.COMBOS)
        .where('active', '==', true)
        .get()

      const combos: Combo[] = []
      combosSnapshot.forEach(doc => {
        combos.push(doc.data() as Combo)
      })

      return combos

    } catch (error) {
      console.error('Get combo suggestions error:', error)
      return []
    }
  }
}

export const orderService = OrderService.getInstance()
