// Data models based on the Billiard POS Design Document
export interface Table {
  id: number
  name: string
  tableType: 'Billiard' | 'Normal' | 'La Barra'
  status: 'free' | 'occupied' | 'reserved' | 'maintenance'
  startedAt: number | null
  freeUntil: number | null
  customerId?: string
  accessCode?: string
  rentalTime?: number // in minutes
  lightOn?: boolean // for billiard tables
  currentSessionId?: string
  cueRented?: boolean
  groupId?: string // for multi-table groups
}

export interface Customer {
  id: string
  name: string
  membershipId?: string
  phone?: string
  email?: string
  loyaltyPoints: number
  totalSpent: number
  lastVisit: number
  createdAt: number
}

export interface Order {
  id: string
  tableId: number
  customerId?: string
  items: OrderItem[]
  combos: ComboOrder[]
  total: number
  discount: number
  billiardTimeCredit?: number // minutes
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: boolean
  notes?: string
  createdAt: number
  updatedAt: number
  employeeId: string
  accessCode: string
}

export interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  modifiers: string[]
  notes?: string
  voided?: boolean
  voidReason?: string
  voidedBy?: string
  voidedAt?: number
}

export interface ComboOrder {
  comboId: string
  name: string
  discount: number
  billiardTimeCredit: number
  appliedAt: number
}

export interface Combo {
  id: string
  name: string
  items: Array<{ id: string; qty: number }>
  price: number
  discount: number
  billiardTimeCredit: number // minutes
  active: boolean
  createdAt: number
}

export interface InventoryItem {
  id: string
  name: string
  category: 'Food' | 'Drinks' | 'Specials' | 'Equipment'
  price: number
  cost: number
  stockLevel: number
  reorderThreshold: number
  unit: string
  sku: string
  active: boolean
}

export interface InventoryMovement {
  id: string
  itemId: string
  type: 'purchase' | 'sale' | 'adjustment' | 'waste' | 'theft'
  quantity: number
  previousStock: number
  newStock: number
  reason?: string
  employeeId: string
  timestamp: number
  accessCode: string
}

export interface Transaction {
  id: string
  orderId: string
  tableId: number
  amount: number
  paymentMethod: 'card' | 'cash' | 'gift_card'
  tip: number
  total: number
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  employeeId: string
  accessCode: string
  timestamp: number
  receiptUrl?: string
}

export interface Employee {
  id: string
  name: string
  role: 'Manager' | 'Cashier' | 'Kitchen' | 'Server'
  accessCode: string
  biometricData?: string
  active: boolean
  createdAt: number
  lastLogin: number
  shiftId?: string
}

export interface Shift {
  id: string
  employeeId: string
  startTime: number
  endTime?: number
  expectedCash: number
  actualCash?: number
  discrepancy?: number
  status: 'active' | 'ended' | 'reconciled'
  createdAt: number
}

export interface AuditLog {
  id: string
  actionType: string
  employeeId: string
  details: any
  timestamp: number
  ipAddress: string
  cctvTimestamp?: number
  tableId?: number
  orderId?: string
  transactionId?: string
  accessCode: string
}

export interface KDSOrder {
  id: string
  orderId: string
  tableId: number
  items: OrderItem[]
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  priority: boolean
  createdAt: number
  updatedAt: number
  assignedTo?: string
  estimatedTime?: number
}

export interface Report {
  id: string
  type: 'sales' | 'table_usage' | 'inventory' | 'combo_redemption' | 'employee_performance' | 'customer_retention' | 'audit_logs' | 'anomaly_detection'
  data: any
  filters: any
  generatedAt: number
  generatedBy: string
  accessCode: string
}

export interface Analytics {
  id: string
  type: 'trends' | 'forecasts' | 'drill_down' | 'anomaly_alerts'
  data: any
  generatedAt: number
  period: string
}

export interface Alert {
  id: string
  type: 'voids' | 'discounts' | 'cash_discrepancy' | 'inventory_mismatch' | 'anomaly'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: any
  resolved: boolean
  createdAt: number
  resolvedAt?: number
  resolvedBy?: string
}

export interface TableMigration {
  id: string
  fromTableId: number
  toTableId: number
  customerId: string
  partialTime: boolean
  timeTransferred: number
  ordersTransferred: boolean
  employeeId: string
  accessCode: string
  timestamp: number
}

export interface CashReconciliation {
  id: string
  shiftId: string
  employeeId: string
  expectedCash: number
  actualCash: number
  discrepancy: number
  notes?: string
  timestamp: number
  accessCode: string
}

export interface LoyaltyProgram {
  id: string
  customerId: string
  points: number
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  totalEarned: number
  totalRedeemed: number
  lastActivity: number
  createdAt: number
}

export interface AccessCodeValidation {
  employeeId: string
  accessCode: string
  isValid: boolean
  role: string
  permissions: string[]
  lastUsed: number
  failedAttempts: number
  lockedUntil?: number
}

// Database collections mapping
export const COLLECTIONS = {
  TABLES: 'mesas',
  CUSTOMERS: 'customers',
  ORDERS: 'orders',
  COMBOS: 'combos',
  INVENTORY: 'inventory',
  MOVEMENTS: 'inventory_movements',
  TRANSACTIONS: 'transactions',
  EMPLOYEES: 'employees',
  SHIFTS: 'shifts',
  AUDIT_LOGS: 'audit_logs',
  KDS_ORDERS: 'kds_orders',
  REPORTS: 'reports',
  ANALYTICS: 'analytics',
  ALERTS: 'alerts',
  MIGRATIONS: 'table_migrations',
  CASH_RECONCILIATION: 'cash_reconciliation',
  LOYALTY: 'loyalty_program',
  ACCESS_CODES: 'access_codes'
} as const
