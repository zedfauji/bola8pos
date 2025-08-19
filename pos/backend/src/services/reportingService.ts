import { randomUUID } from 'crypto'
import { getDb } from '../config/firebaseNode'
import { Report, Analytics, Alert, COLLECTIONS, Order, Table, Employee, InventoryItem, Combo } from '../models'
import { authService } from './auth.service'

export interface ReportFilters {
  dateFrom: number
  dateTo: number
  tableType?: 'Billiard' | 'Normal' | 'La Barra'
  employeeId?: string
  category?: string
  status?: string
}

export interface SalesReport {
  totalSales: number
  totalOrders: number
  averageOrderValue: number
  salesByHour: { hour: number; amount: number }[]
  salesByDay: { day: string; amount: number; orders: number }[]
  topItems: { name: string; quantity: number; revenue: number }[]
  topCombos: { name: string; quantity: number; revenue: number }[]
  paymentMethods: { method: string; amount: number; count: number }[]
}

export interface TableUsageReport {
  totalTables: number
  occupiedTables: number
  utilizationRate: number
  averageSessionTime: number
  revenuePerTable: { tableId: number; name: string; revenue: number; sessions: number }[]
  tableTypeBreakdown: { type: string; count: number; utilization: number }[]
}

export interface InventoryReport {
  totalItems: number
  lowStockItems: { name: string; currentStock: number; threshold: number }[]
  topSellingItems: { name: string; quantity: number; revenue: number }[]
  stockValue: number
  categoryBreakdown: { category: string; count: number; value: number }[]
}

export interface EmployeePerformanceReport {
  totalEmployees: number
  topPerformers: { name: string; sales: number; orders: number; averageOrder: number }[]
  salesByEmployee: { employeeId: string; name: string; sales: number; orders: number }[]
  voidRate: { employeeId: string; name: string; voids: number; totalOrders: number; rate: number }[]
}

export interface CustomerRetentionReport {
  totalCustomers: number
  newCustomers: number
  returningCustomers: number
  retentionRate: number
  averageLifetimeValue: number
  topCustomers: { name: string; visits: number; totalSpent: number; lastVisit: number }[]
}

export interface AnomalyDetectionResult {
  anomalies: {
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    data: any
    timestamp: number
  }[]
  alertsCreated: number
}

export class ReportingService {
  private static instance: ReportingService

  static getInstance(): ReportingService {
    if (!ReportingService.instance) {
      ReportingService.instance = new ReportingService()
    }
    return ReportingService.instance
  }

  async generateSalesReport(filters: ReportFilters, employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; report?: SalesReport; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'reporting')) {
        return { success: false, message: 'Insufficient permissions for reporting.' }
      }

      const db = getDb()

      // Get orders within date range
      const ordersSnapshot = await db.collection(COLLECTIONS.ORDERS)
        .where('createdAt', '>=', filters.dateFrom)
        .where('createdAt', '<=', filters.dateTo)
        .get()

      const orders: Order[] = []
      ordersSnapshot.forEach(doc => {
        orders.push(doc.data() as Order)
      })

      // Calculate sales metrics
      const totalSales = orders.reduce((sum, order) => sum + order.total, 0)
      const totalOrders = orders.length
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

      // Sales by hour
      const salesByHour = new Array(24).fill(0).map((_, hour) => ({ hour, amount: 0 }))
      orders.forEach(order => {
        const date = new Date(order.createdAt)
        const hour = date.getHours()
        salesByHour[hour].amount += order.total
      })

      // Sales by day
      const salesByDayMap = new Map<string, { amount: number; orders: number }>()
      orders.forEach(order => {
        const date = new Date(order.createdAt)
        const day = date.toISOString().split('T')[0]
        const existing = salesByDayMap.get(day) || { amount: 0, orders: 0 }
        existing.amount += order.total
        existing.orders += 1
        salesByDayMap.set(day, existing)
      })

      const salesByDay = Array.from(salesByDayMap.entries()).map(([day, data]) => ({
        day,
        ...data
      }))

      // Top items
      const itemSales = new Map<string, { quantity: number; revenue: number }>()
      orders.forEach(order => {
        order.items.forEach(item => {
          if (!item.voided) {
            const existing = itemSales.get(item.name) || { quantity: 0, revenue: 0 }
            existing.quantity += item.quantity
            existing.revenue += item.price * item.quantity
            itemSales.set(item.name, existing)
          }
        })
      })

      const topItems = Array.from(itemSales.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      // Top combos
      const comboSales = new Map<string, { quantity: number; revenue: number }>()
      orders.forEach(order => {
        order.combos.forEach(combo => {
          const existing = comboSales.get(combo.name) || { quantity: 0, revenue: 0 }
          existing.quantity += 1
          existing.revenue += combo.discount
          comboSales.set(combo.name, existing)
        })
      })

      const topCombos = Array.from(comboSales.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      // Payment methods (simplified - would need transaction data)
      const paymentMethods = [
        { method: 'card', amount: totalSales * 0.7, count: Math.floor(totalOrders * 0.7) },
        { method: 'cash', amount: totalSales * 0.3, count: Math.floor(totalOrders * 0.3) }
      ]

      const salesReport: SalesReport = {
        totalSales,
        totalOrders,
        averageOrderValue,
        salesByHour,
        salesByDay,
        topItems,
        topCombos,
        paymentMethods
      }

      // Save report
      await this.saveReport('sales', salesReport, filters, employeeId, accessCode)

      return { success: true, report: salesReport }

    } catch (error) {
      console.error('Generate sales report error:', error)
      return { success: false, message: 'Failed to generate sales report. Please try again.' }
    }
  }

  async generateTableUsageReport(filters: ReportFilters, employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; report?: TableUsageReport; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'reporting')) {
        return { success: false, message: 'Insufficient permissions for reporting.' }
      }

      const db = getDb()

      // Get all tables
      const tablesSnapshot = await db.collection(COLLECTIONS.TABLES).get()
      const tables: Table[] = []
      tablesSnapshot.forEach(doc => {
        tables.push(doc.data() as Table)
      })

      const totalTables = tables.length
      const occupiedTables = tables.filter(t => t.status === 'occupied').length
      const utilizationRate = totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0

      // Calculate average session time
      const occupiedTablesWithTime = tables.filter(t => t.startedAt)
      const totalSessionTime = occupiedTablesWithTime.reduce((sum, table) => {
        return sum + (Date.now() - (table.startedAt || 0))
      }, 0)
      const averageSessionTime = occupiedTablesWithTime.length > 0 ? totalSessionTime / occupiedTablesWithTime.length : 0

      // Revenue per table
      const revenuePerTable = await Promise.all(
        tables.map(async (table) => {
          const ordersSnapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('tableId', '==', table.id)
            .where('createdAt', '>=', filters.dateFrom)
            .where('createdAt', '<=', filters.dateTo)
            .get()

          const revenue = ordersSnapshot.docs.reduce((sum, doc) => {
            const order = doc.data() as Order
            return sum + order.total
          }, 0)

          const sessions = ordersSnapshot.size

          return {
            tableId: table.id,
            name: table.name,
            revenue,
            sessions
          }
        })
      )

      // Table type breakdown
      const tableTypeBreakdown = ['Billiard', 'Normal', 'La Barra'].map(type => {
        const typeTables = tables.filter(t => t.tableType === type)
        const typeOccupied = typeTables.filter(t => t.status === 'occupied').length
        const utilization = typeTables.length > 0 ? (typeOccupied / typeTables.length) * 100 : 0

        return {
          type,
          count: typeTables.length,
          utilization
        }
      })

      const tableUsageReport: TableUsageReport = {
        totalTables,
        occupiedTables,
        utilizationRate,
        averageSessionTime,
        revenuePerTable,
        tableTypeBreakdown
      }

      // Save report
      await this.saveReport('table_usage', tableUsageReport, filters, employeeId, accessCode)

      return { success: true, report: tableUsageReport }

    } catch (error) {
      console.error('Generate table usage report error:', error)
      return { success: false, message: 'Failed to generate table usage report. Please try again.' }
    }
  }

  async generateInventoryReport(filters: ReportFilters, employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; report?: InventoryReport; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'inventory_management')) {
        return { success: false, message: 'Insufficient permissions for inventory management.' }
      }

      const db = getDb()

      // Get all inventory items
      const inventorySnapshot = await db.collection(COLLECTIONS.INVENTORY).get()
      const inventoryItems: InventoryItem[] = []
      inventorySnapshot.forEach(doc => {
        inventoryItems.push(doc.data() as InventoryItem)
      })

      const totalItems = inventoryItems.length

      // Low stock items
      const lowStockItems = inventoryItems
        .filter(item => item.stockLevel <= item.reorderThreshold)
        .map(item => ({
          name: item.name,
          currentStock: item.stockLevel,
          threshold: item.reorderThreshold
        }))

      // Top selling items (simplified - would need movement data)
      const topSellingItems = inventoryItems
        .slice(0, 10)
        .map(item => ({
          name: item.name,
          quantity: Math.floor(Math.random() * 100), // Placeholder
          revenue: Math.floor(Math.random() * 1000) // Placeholder
        }))
        .sort((a, b) => b.revenue - a.revenue)

      // Stock value
      const stockValue = inventoryItems.reduce((sum, item) => {
        return sum + (item.stockLevel * item.cost)
      }, 0)

      // Category breakdown
      const categoryBreakdown = ['Food', 'Drinks', 'Specials', 'Equipment'].map(category => {
        const categoryItems = inventoryItems.filter(item => item.category === category)
        const count = categoryItems.length
        const value = categoryItems.reduce((sum, item) => sum + (item.stockLevel * item.cost), 0)

        return { category, count, value }
      })

      const inventoryReport: InventoryReport = {
        totalItems,
        lowStockItems,
        topSellingItems,
        stockValue,
        categoryBreakdown
      }

      // Save report
      await this.saveReport('inventory', inventoryReport, filters, employeeId, accessCode)

      return { success: true, report: inventoryReport }

    } catch (error) {
      console.error('Generate inventory report error:', error)
      return { success: false, message: 'Failed to generate inventory report. Please try again.' }
    }
  }

  async generateEmployeePerformanceReport(filters: ReportFilters, employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; report?: EmployeePerformanceReport; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'reporting')) {
        return { success: false, message: 'Insufficient permissions for reporting.' }
      }

      const db = getDb()

      // Get all employees
      const employeesSnapshot = await db.collection(COLLECTIONS.EMPLOYEES).get()
      const employees: Employee[] = []
      employeesSnapshot.forEach(doc => {
        employees.push(doc.data() as Employee)
      })

      const totalEmployees = employees.length

      // Get orders for performance calculation
      const ordersSnapshot = await db.collection(COLLECTIONS.ORDERS)
        .where('createdAt', '>=', filters.dateFrom)
        .where('createdAt', '<=', filters.dateTo)
        .get()

      const orders: Order[] = []
      ordersSnapshot.forEach(doc => {
        orders.push(doc.data() as Order)
      })

      // Calculate performance metrics
      const employeePerformance = new Map<string, { sales: number; orders: number; voids: number; totalOrders: number }>()

      orders.forEach(order => {
        const existing = employeePerformance.get(order.employeeId) || { sales: 0, orders: 0, voids: 0, totalOrders: 0 }
        existing.sales += order.total
        existing.orders += 1
        existing.totalOrders += 1

        // Count voids
        const voidedItems = order.items.filter(item => item.voided).length
        existing.voids += voidedItems

        employeePerformance.set(order.employeeId, existing)
      })

      // Top performers
      const topPerformers = Array.from(employeePerformance.entries())
        .map(([employeeId, data]) => {
          const employee = employees.find(e => e.id === employeeId)
          const averageOrder = data.orders > 0 ? data.sales / data.orders : 0

          return {
            name: employee?.name || 'Unknown',
            sales: data.sales,
            orders: data.orders,
            averageOrder
          }
        })
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10)

      // Sales by employee
      const salesByEmployee = Array.from(employeePerformance.entries())
        .map(([employeeId, data]) => {
          const employee = employees.find(e => e.id === employeeId)
          return {
            employeeId,
            name: employee?.name || 'Unknown',
            sales: data.sales,
            orders: data.orders
          }
        })

      // Void rate
      const voidRate = Array.from(employeePerformance.entries())
        .map(([employeeId, data]) => {
          const employee = employees.find(e => e.id === employeeId)
          const rate = data.totalOrders > 0 ? (data.voids / data.totalOrders) * 100 : 0

          return {
            employeeId,
            name: employee?.name || 'Unknown',
            voids: data.voids,
            totalOrders: data.totalOrders,
            rate
          }
        })
        .sort((a, b) => b.rate - a.rate)

      const employeePerformanceReport: EmployeePerformanceReport = {
        totalEmployees,
        topPerformers,
        salesByEmployee,
        voidRate
      }

      // Save report
      await this.saveReport('employee_performance', employeePerformanceReport, filters, employeeId, accessCode)

      return { success: true, report: employeePerformanceReport }

    } catch (error) {
      console.error('Generate employee performance report error:', error)
      return { success: false, message: 'Failed to generate employee performance report. Please try again.' }
    }
  }

  async detectAnomalies(employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; result?: AnomalyDetectionResult; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'analytics')) {
        return { success: false, message: 'Insufficient permissions for analytics.' }
      }

      const db = getDb()
      const anomalies: any[] = []
      let alertsCreated = 0

      // Get recent orders for analysis
      const recentOrdersSnapshot = await db.collection(COLLECTIONS.ORDERS)
        .where('createdAt', '>=', Date.now() - (24 * 60 * 60 * 1000)) // Last 24 hours
        .get()

      const recentOrders: Order[] = []
      recentOrdersSnapshot.forEach(doc => {
        recentOrders.push(doc.data() as Order)
      })

      // Analyze void rates
      const voidRates = new Map<string, { voids: number; total: number }>()
      recentOrders.forEach(order => {
        const existing = voidRates.get(order.employeeId) || { voids: 0, total: 0 }
        existing.total += 1
        existing.voids += order.items.filter(item => item.voided).length
        voidRates.set(order.employeeId, existing)
      })

      // Check for high void rates (>5%)
      voidRates.forEach((data, employeeId) => {
        const voidRate = (data.voids / data.total) * 100
        if (voidRate > 5) {
          anomalies.push({
            type: 'high_void_rate',
            severity: voidRate > 10 ? 'critical' : 'high',
            description: `Employee has ${voidRate.toFixed(1)}% void rate`,
            data: { employeeId, voidRate, voids: data.voids, total: data.total },
            timestamp: Date.now()
          })

          // Create alert
          this.createAlert('voids', voidRate > 10 ? 'critical' : 'high', 
            `High void rate detected: ${voidRate.toFixed(1)}%`, {
              employeeId,
              voidRate,
              voids: data.voids,
              total: data.total
            })
          alertsCreated++
        }
      })

      // Analyze order amounts for unusual patterns
      const orderAmounts = recentOrders.map(order => order.total)
      const averageAmount = orderAmounts.reduce((sum, amount) => sum + amount, 0) / orderAmounts.length
      const standardDeviation = Math.sqrt(
        orderAmounts.reduce((sum, amount) => sum + Math.pow(amount - averageAmount, 2), 0) / orderAmounts.length
      )

      // Check for orders that are 2+ standard deviations from mean
      recentOrders.forEach(order => {
        if (Math.abs(order.total - averageAmount) > 2 * standardDeviation) {
          anomalies.push({
            type: 'unusual_order_amount',
            severity: 'medium',
            description: `Unusual order amount: $${order.total}`,
            data: { orderId: order.id, amount: order.total, average: averageAmount, deviation: standardDeviation },
            timestamp: Date.now()
          })
        }
      })

      // Check for rapid successive orders (potential duplicate orders)
      const ordersByTable = new Map<number, Order[]>()
      recentOrders.forEach(order => {
        const existing = ordersByTable.get(order.tableId) || []
        existing.push(order)
        ordersByTable.set(order.tableId, existing)
      })

      ordersByTable.forEach((tableOrders, tableId) => {
        if (tableOrders.length > 3) {
          // Check for orders within 5 minutes of each other
          const sortedOrders = tableOrders.sort((a, b) => a.createdAt - b.createdAt)
          for (let i = 1; i < sortedOrders.length; i++) {
            const timeDiff = sortedOrders[i].createdAt - sortedOrders[i-1].createdAt
            if (timeDiff < 5 * 60 * 1000) { // 5 minutes
              anomalies.push({
                type: 'rapid_successive_orders',
                severity: 'low',
                description: `Rapid successive orders on table ${tableId}`,
                data: { tableId, timeDiff: timeDiff / 1000 / 60, orders: sortedOrders.length },
                timestamp: Date.now()
              })
              break
            }
          }
        }
      })

      const anomalyDetectionResult: AnomalyDetectionResult = {
        anomalies,
        alertsCreated
      }

      // Save analytics
      await this.saveAnalytics('anomaly_alerts', anomalyDetectionResult, '24h', employeeId, accessCode)

      return { success: true, result: anomalyDetectionResult }

    } catch (error) {
      console.error('Anomaly detection error:', error)
      return { success: false, message: 'Failed to detect anomalies. Please try again.' }
    }
  }

  private async saveReport(type: string, data: any, filters: any, employeeId: string, accessCode: string): Promise<void> {
    try {
      const db = getDb()
      const reportId = randomUUID()
      
      const report: Report = {
        id: reportId,
        type: type as any,
        data,
        filters,
        generatedAt: Date.now(),
        generatedBy: employeeId,
        accessCode
      }

      await db.collection(COLLECTIONS.REPORTS).doc(reportId).set(report)

    } catch (error) {
      console.error('Save report error:', error)
    }
  }

  private async saveAnalytics(type: string, data: any, period: string, employeeId: string, accessCode: string): Promise<void> {
    try {
      const db = getDb()
      const analyticsId = randomUUID()
      
      const analytics: Analytics = {
        id: analyticsId,
        type: type as any,
        data,
        generatedAt: Date.now(),
        period
      }

      await db.collection(COLLECTIONS.ANALYTICS).doc(analyticsId).set(analytics)

    } catch (error) {
      console.error('Save analytics error:', error)
    }
  }

  private async createAlert(type: string, severity: string, message: string, details: any): Promise<void> {
    try {
      const db = getDb()
      const alertId = randomUUID()
      
      const alert = {
        id: alertId,
        type,
        severity,
        message,
        details,
        resolved: false,
        createdAt: Date.now()
      }

      await db.collection(COLLECTIONS.ALERTS).doc(alertId).set(alert)

    } catch (error) {
      console.error('Create alert error:', error)
    }
  }

  async getReportsByType(type: string, employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; reports?: Report[]; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'reporting')) {
        return { success: false, message: 'Insufficient permissions for reporting.' }
      }

      const db = getDb()
      const reportsSnapshot = await db.collection(COLLECTIONS.REPORTS)
        .where('type', '==', type)
        .orderBy('generatedAt', 'desc')
        .limit(50)
        .get()

      const reports: Report[] = []
      reportsSnapshot.forEach(doc => {
        reports.push(doc.data() as Report)
      })

      return { success: true, reports }

    } catch (error) {
      console.error('Get reports by type error:', error)
      return { success: false, message: 'Failed to get reports. Please try again.' }
    }
  }

  async exportReport(reportId: string, format: 'pdf' | 'excel' | 'csv', employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; url?: string; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'reporting')) {
        return { success: false, message: 'Insufficient permissions for reporting.' }
      }

      // This would implement actual export functionality
      // For now, return a placeholder
      const exportUrl = `/exports/${reportId}.${format}`

      // Log the export
      await authService.logAudit('REPORT_EXPORTED', employeeId, {
        reportId,
        format,
        exportUrl,
        ipAddress,
        accessCode
      })

      return { success: true, url: exportUrl }

    } catch (error) {
      console.error('Export report error:', error)
      return { success: false, message: 'Failed to export report. Please try again.' }
    }
  }
}

export const reportingService = ReportingService.getInstance()
