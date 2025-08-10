import { randomUUID } from 'crypto'
import { getDb } from '../config/firebaseNode'
import { Table, Customer, TableMigration, COLLECTIONS } from '../models'
import { authService } from './auth.service'

export interface TableAssignmentRequest {
  tableId: number
  customerId: string
  employeeId: string
  accessCode: string
  ipAddress: string
}

export interface TableMigrationRequest {
  fromTableId: number
  toTableId: number
  customerId: string
  employeeId: string
  accessCode: string
  ipAddress: string
  partialTime?: boolean
}

export interface TableStatus {
  id: number
  name: string
  tableType: 'Billiard' | 'Normal' | 'La Barra'
  status: 'free' | 'occupied' | 'reserved' | 'maintenance'
  startedAt: number | null
  freeUntil: number | null
  customerId?: string
  customerName?: string
  rentalTime?: number
  lightOn?: boolean
  currentSessionId?: string
  cueRented?: boolean
  groupId?: string
  orderTotal?: number
  timerDisplay?: string
}

export interface TableGroup {
  id: string
  tables: number[]
  customerId: string
  totalOrderAmount: number
  createdAt: number
}

export class TableService {
  private static instance: TableService
  private tableTimers: Map<number, NodeJS.Timeout> = new Map()
  private tableLights: Map<number, boolean> = new Map()

  static getInstance(): TableService {
    if (!TableService.instance) {
      TableService.instance = new TableService()
    }
    return TableService.instance
  }

  async assignTable(request: TableAssignmentRequest): Promise<{ success: boolean; message?: string; table?: TableStatus }> {
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

      if (!authService.hasPermission(request.employeeId, 'table_management')) {
        return { success: false, message: 'Insufficient permissions for table management.' }
      }

      const db = getDb()

      // Check if table is available
      const tableDoc = await db.collection(COLLECTIONS.TABLES).doc(request.tableId.toString()).get()
      if (!tableDoc.exists) {
        return { success: false, message: 'Table not found.' }
      }

      const table = tableDoc.data() as Table
      if (table.status !== 'free') {
        return { success: false, message: `Table ${table.name} is not available.` }
      }

      // Get customer info
      const customerDoc = await db.collection(COLLECTIONS.CUSTOMERS).doc(request.customerId).get()
      if (!customerDoc.exists) {
        return { success: false, message: 'Customer not found.' }
      }

      const customer = customerDoc.data() as Customer

      // Create session ID for tracking
      const sessionId = randomUUID()
      const now = Date.now()

      // Update table status
      const tableUpdate: Partial<Table> = {
        status: 'occupied',
        customerId: request.customerId,
        startedAt: now,
        currentSessionId: sessionId,
        lightOn: table.tableType === 'Billiard' ? true : false
      }

      await db.collection(COLLECTIONS.TABLES).doc(request.tableId.toString()).update(tableUpdate)

      // Start timer for billiard tables
      if (table.tableType === 'Billiard') {
        this.startTableTimer(request.tableId)
        this.controlTableLight(request.tableId, true)
      }

      // Log the assignment
      await authService.logAudit('TABLE_ASSIGNED', request.employeeId, {
        tableId: request.tableId,
        tableName: table.name,
        customerId: request.customerId,
        customerName: customer.name,
        sessionId,
        ipAddress: request.ipAddress,
        accessCode: request.accessCode
      })

      // Get updated table status
      const updatedTable = await this.getTableStatus(request.tableId)
      
      return { success: true, table: updatedTable }

    } catch (error) {
      console.error('Table assignment error:', error)
      return { success: false, message: 'Failed to assign table. Please try again.' }
    }
  }

  async migrateTable(request: TableMigrationRequest): Promise<{ success: boolean; message?: string; migration?: TableMigration }> {
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

      if (!authService.hasPermission(request.employeeId, 'table_management')) {
        return { success: false, message: 'Insufficient permissions for table migration.' }
      }

      const db = getDb()

      // Check source table
      const fromTableDoc = await db.collection(COLLECTIONS.TABLES).doc(request.fromTableId.toString()).get()
      if (!fromTableDoc.exists) {
        return { success: false, message: 'Source table not found.' }
      }

      const fromTable = fromTableDoc.data() as Table
      if (fromTable.status !== 'occupied' || fromTable.customerId !== request.customerId) {
        return { success: false, message: 'Source table is not occupied by the specified customer.' }
      }

      // Check destination table
      const toTableDoc = await db.collection(COLLECTIONS.TABLES).doc(request.toTableId.toString()).get()
      if (!toTableDoc.exists) {
        return { success: false, message: 'Destination table not found.' }
      }

      const toTable = toTableDoc.data() as Table
      if (toTable.status !== 'free') {
        return { success: false, message: 'Destination table is not available.' }
      }

      // Calculate time to transfer
      const timeToTransfer = fromTable.startedAt ? Math.floor((Date.now() - fromTable.startedAt) / 1000 / 60) : 0

      // Create migration record
      const migrationId = randomUUID()
      const migration: TableMigration = {
        id: migrationId,
        fromTableId: request.fromTableId,
        toTableId: request.toTableId,
        customerId: request.customerId,
        partialTime: request.partialTime || false,
        timeTransferred: timeToTransfer,
        ordersTransferred: true,
        employeeId: request.employeeId,
        accessCode: request.accessCode,
        timestamp: Date.now()
      }

      await db.collection(COLLECTIONS.MIGRATIONS).doc(migrationId).set(migration)

      // Stop timer and turn off light on source table
      if (fromTable.tableType === 'Billiard') {
        this.stopTableTimer(request.fromTableId)
        this.controlTableLight(request.fromTableId, false)
      }

      // Free source table
      await db.collection(COLLECTIONS.TABLES).doc(request.fromTableId.toString()).update({
        status: 'free',
        customerId: null,
        startedAt: null,
        currentSessionId: null,
        lightOn: false
      })

      // Occupy destination table
      const now = Date.now()
      const sessionId = randomUUID()
      
      await db.collection(COLLECTIONS.TABLES).doc(request.toTableId.toString()).update({
        status: 'occupied',
        customerId: request.customerId,
        startedAt: now,
        currentSessionId: sessionId,
        lightOn: toTable.tableType === 'Billiard' ? true : false
      })

      // Start timer on destination table if it's a billiard table
      if (toTable.tableType === 'Billiard') {
        this.startTableTimer(request.toTableId)
        this.controlTableLight(request.toTableId, true)
      }

      // Log the migration
      await authService.logAudit('TABLE_MIGRATED', request.employeeId, {
        migrationId,
        fromTableId: request.fromTableId,
        toTableId: request.toTableId,
        customerId: request.customerId,
        timeTransferred,
        sessionId,
        ipAddress: request.ipAddress,
        accessCode: request.accessCode
      })

      return { success: true, migration }

    } catch (error) {
      console.error('Table migration error:', error)
      return { success: false, message: 'Failed to migrate table. Please try again.' }
    }
  }

  async freeTable(tableId: number, employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'table_management')) {
        return { success: false, message: 'Insufficient permissions for table management.' }
      }

      const db = getDb()
      const tableDoc = await db.collection(COLLECTIONS.TABLES).doc(tableId.toString()).get()
      
      if (!tableDoc.exists) {
        return { success: false, message: 'Table not found.' }
      }

      const table = tableDoc.data() as Table
      if (table.status !== 'occupied') {
        return { success: false, message: 'Table is not occupied.' }
      }

      // Stop timer and turn off light for billiard tables
      if (table.tableType === 'Billiard') {
        this.stopTableTimer(tableId)
        this.controlTableLight(tableId, false)
      }

      // Free the table
      await db.collection(COLLECTIONS.TABLES).doc(tableId.toString()).update({
        status: 'free',
        customerId: null,
        startedAt: null,
        currentSessionId: null,
        lightOn: false,
        rentalTime: null
      })

      // Log the action
      await authService.logAudit('TABLE_FREED', employeeId, {
        tableId,
        tableName: table.name,
        customerId: table.customerId,
        sessionId: table.currentSessionId,
        ipAddress,
        accessCode
      })

      return { success: true }

    } catch (error) {
      console.error('Free table error:', error)
      return { success: false, message: 'Failed to free table. Please try again.' }
    }
  }

  async getTableStatus(tableId: number): Promise<TableStatus | null> {
    try {
      const db = getDb()
      const tableDoc = await db.collection(COLLECTIONS.TABLES).doc(tableId.toString()).get()
      
      if (!tableDoc.exists) {
        return null
      }

      const table = tableDoc.data() as Table
      
      // Calculate timer display for billiard tables
      let timerDisplay: string | undefined
      if (table.tableType === 'Billiard' && table.startedAt) {
        const elapsedMinutes = Math.floor((Date.now() - table.startedAt) / 1000 / 60)
        const hours = Math.floor(elapsedMinutes / 60)
        const minutes = elapsedMinutes % 60
        timerDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
      }

      // Get customer name if table is occupied
      let customerName: string | undefined
      if (table.customerId) {
        const customerDoc = await db.collection(COLLECTIONS.CUSTOMERS).doc(table.customerId).get()
        if (customerDoc.exists) {
          const customer = customerDoc.data() as Customer
          customerName = customer.name
        }
      }

      // Calculate rental time
      let rentalTime: number | undefined
      if (table.startedAt) {
        rentalTime = Math.floor((Date.now() - table.startedAt) / 1000 / 60)
      }

      return {
        ...table,
        customerName,
        timerDisplay,
        rentalTime
      }

    } catch (error) {
      console.error('Get table status error:', error)
      return null
    }
  }

  async getAllTables(): Promise<TableStatus[]> {
    try {
      const db = getDb()
      const tablesSnapshot = await db.collection(COLLECTIONS.TABLES).get()
      
      const tables: TableStatus[] = []
      
      for (const doc of tablesSnapshot.docs) {
        const tableStatus = await this.getTableStatus(parseInt(doc.id))
        if (tableStatus) {
          tables.push(tableStatus)
        }
      }

      return tables.sort((a, b) => a.id - b.id)

    } catch (error) {
      console.error('Get all tables error:', error)
      return []
    }
  }

  async getTablesByType(tableType: 'Billiard' | 'Normal' | 'La Barra'): Promise<TableStatus[]> {
    try {
      const allTables = await this.getAllTables()
      return allTables.filter(table => table.tableType === tableType)
    } catch (error) {
      console.error('Get tables by type error:', error)
      return []
    }
  }

  async controlTableLight(tableId: number, lightOn: boolean): Promise<boolean> {
    try {
      // In production, this would integrate with actual light control hardware
      this.tableLights.set(tableId, lightOn)
      
      // Log light control action
      console.log(`Table ${tableId} light ${lightOn ? 'ON' : 'OFF'}`)
      
      return true
    } catch (error) {
      console.error('Light control error:', error)
      return false
    }
  }

  async getTableLightStatus(tableId: number): Promise<boolean> {
    return this.tableLights.get(tableId) || false
  }

  private startTableTimer(tableId: number): void {
    // Stop existing timer if any
    this.stopTableTimer(tableId)

    // Start new timer
    const timer = setInterval(() => {
      // Timer logic - could emit events for real-time updates
      console.log(`Table ${tableId} timer tick`)
    }, 60000) // Update every minute

    this.tableTimers.set(tableId, timer)
  }

  private stopTableTimer(tableId: number): void {
    const timer = this.tableTimers.get(tableId)
    if (timer) {
      clearInterval(timer)
      this.tableTimers.delete(tableId)
    }
  }

  async createTableGroup(tables: number[], customerId: string, employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; groupId?: string; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'table_management')) {
        return { success: false, message: 'Insufficient permissions for table management.' }
      }

      // Check if all tables are available
      for (const tableId of tables) {
        const tableStatus = await this.getTableStatus(tableId)
        if (!tableStatus || tableStatus.status !== 'free') {
          return { success: false, message: `Table ${tableId} is not available for grouping.` }
        }
      }

      const groupId = randomUUID()
      const now = Date.now()

      // Assign all tables to the group
      const db = getDb()
      for (const tableId of tables) {
        await db.collection(COLLECTIONS.TABLES).doc(tableId.toString()).update({
          status: 'occupied',
          customerId,
          startedAt: now,
          currentSessionId: groupId,
          groupId
        })

        // Start timers for billiard tables
        const tableStatus = await this.getTableStatus(tableId)
        if (tableStatus?.tableType === 'Billiard') {
          this.startTableTimer(tableId)
          this.controlTableLight(tableId, true)
        }
      }

      // Log the group creation
      await authService.logAudit('TABLE_GROUP_CREATED', employeeId, {
        groupId,
        tableIds: tables,
        customerId,
        ipAddress,
        accessCode
      })

      return { success: true, groupId }

    } catch (error) {
      console.error('Create table group error:', error)
      return { success: false, message: 'Failed to create table group. Please try again.' }
    }
  }

  async getTableGroup(groupId: string): Promise<TableStatus[]> {
    try {
      const db = getDb()
      const tablesSnapshot = await db.collection(COLLECTIONS.TABLES)
        .where('groupId', '==', groupId)
        .get()

      const tables: TableStatus[] = []
      
      for (const doc of tablesSnapshot.docs) {
        const tableStatus = await this.getTableStatus(parseInt(doc.id))
        if (tableStatus) {
          tables.push(tableStatus)
        }
      }

      return tables.sort((a, b) => a.id - b.id)

    } catch (error) {
      console.error('Get table group error:', error)
      return []
    }
  }

  async getWaitingList(): Promise<Customer[]> {
    try {
      // This would implement a waiting list system
      // For now, return empty array
      return []
    } catch (error) {
      console.error('Get waiting list error:', error)
      return []
    }
  }

  async addToWaitingList(customer: Customer, employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Validate access code and permissions
      const authResult = await authService.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      if (!authService.hasPermission(employeeId, 'table_management')) {
        return { success: false, message: 'Insufficient permissions for table management.' }
      }

      // This would implement adding customer to waiting list
      // For now, just log the action
      await authService.logAudit('CUSTOMER_ADDED_TO_WAITING_LIST', employeeId, {
        customerId: customer.id,
        customerName: customer.name,
        ipAddress,
        accessCode
      })

      return { success: true }

    } catch (error) {
      console.error('Add to waiting list error:', error)
      return { success: false, message: 'Failed to add customer to waiting list.' }
    }
  }
}

export const tableService = TableService.getInstance()
