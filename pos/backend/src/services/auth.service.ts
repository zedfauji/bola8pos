import { randomUUID } from 'crypto'
import { getDb } from '../config/firebaseNode'
import { Employee, AccessCodeValidation, AuditLog, COLLECTIONS } from '../models'

export interface AuthResult {
  success: boolean
  employee?: Employee
  role?: string
  permissions?: string[]
  message?: string
  accessCode?: string
}

export interface BiometricData {
  type: 'fingerprint' | 'pin' | 'face'
  data: string
  timestamp: number
}

export class AuthService {
  private static instance: AuthService
  private accessCodeCache: Map<string, AccessCodeValidation> = new Map()
  private failedAttempts: Map<string, number> = new Map()
  private lockouts: Map<string, number> = new Map()

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  async validateAccessCode(employeeId: string, accessCode: string, ipAddress: string): Promise<AuthResult> {
    try {
      // Check if account is locked
      const lockoutUntil = this.lockouts.get(employeeId)
      if (lockoutUntil && Date.now() < lockoutUntil) {
        const remainingTime = Math.ceil((lockoutUntil - Date.now()) / 1000 / 60)
        await this.logAudit('ACCESS_CODE_LOCKOUT', employeeId, {
          accessCode,
          ipAddress,
          remainingLockoutMinutes: remainingTime
        })
        return {
          success: false,
          message: `Account locked. Try again in ${remainingTime} minutes.`
        }
      }

      // Check failed attempts
      const failedCount = this.failedAttempts.get(employeeId) || 0
      if (failedCount >= 3) {
        // Lock account for 15 minutes
        const lockoutTime = Date.now() + (15 * 60 * 1000)
        this.lockouts.set(employeeId, lockoutTime)
        this.failedAttempts.delete(employeeId)
        
        await this.logAudit('ACCOUNT_LOCKED', employeeId, {
          accessCode,
          ipAddress,
          lockoutDuration: '15 minutes',
          reason: 'Too many failed attempts'
        })
        
        return {
          success: false,
          message: 'Account locked due to too many failed attempts. Try again in 15 minutes.'
        }
      }

      // Validate access code
      const db = getDb()
      const employeeDoc = await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).get()
      
      if (!employeeDoc.exists) {
        await this.recordFailedAttempt(employeeId, accessCode, ipAddress)
        return {
          success: false,
          message: 'Invalid employee ID or access code.'
        }
      }

      const employee = employeeDoc.data() as Employee
      
      if (!employee.active) {
        await this.logAudit('INACTIVE_EMPLOYEE_ACCESS', employeeId, {
          accessCode,
          ipAddress
        })
        return {
          success: false,
          message: 'Employee account is inactive.'
        }
      }

      if (employee.accessCode !== accessCode) {
        await this.recordFailedAttempt(employeeId, accessCode, ipAddress)
        return {
          success: false,
          message: 'Invalid access code.'
        }
      }

      // Success - reset failed attempts and update last login
      this.failedAttempts.delete(employeeId)
      this.lockouts.delete(employeeId)
      
      // Update last login
      await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).update({
        lastLogin: Date.now()
      })

      // Cache successful validation
      const validation: AccessCodeValidation = {
        employeeId,
        accessCode,
        isValid: true,
        role: employee.role,
        permissions: this.getPermissionsForRole(employee.role),
        lastUsed: Date.now(),
        failedAttempts: 0
      }
      
      this.accessCodeCache.set(employeeId, validation)

      // Log successful access
      await this.logAudit('ACCESS_CODE_SUCCESS', employeeId, {
        accessCode,
        ipAddress,
        role: employee.role
      })

      return {
        success: true,
        employee,
        role: employee.role,
        permissions: this.getPermissionsForRole(employee.role),
        accessCode
      }

    } catch (error) {
      console.error('Auth validation error:', error)
      await this.logAudit('AUTH_ERROR', employeeId, {
        accessCode,
        ipAddress,
        error: error.message
      })
      
      return {
        success: false,
        message: 'Authentication service error. Please try again.'
      }
    }
  }

  async validateBiometric(employeeId: string, biometricData: BiometricData, ipAddress: string): Promise<AuthResult> {
    try {
      const db = getDb()
      const employeeDoc = await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).get()
      
      if (!employeeDoc.exists) {
        await this.logAudit('BIOMETRIC_FAILED', employeeId, {
          biometricType: biometricData.type,
          ipAddress,
          reason: 'Employee not found'
        })
        return {
          success: false,
          message: 'Invalid employee ID or biometric data.'
        }
      }

      const employee = employeeDoc.data() as Employee
      
      if (!employee.active) {
        await this.logAudit('INACTIVE_EMPLOYEE_BIOMETRIC', employeeId, {
          biometricType: biometricData.type,
          ipAddress
        })
        return {
          success: false,
          message: 'Employee account is inactive.'
        }
      }

      // For now, we'll use a simple validation
      // In production, this would integrate with proper biometric hardware
      if (employee.biometricData && employee.biometricData === biometricData.data) {
        // Update last login
        await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).update({
          lastLogin: Date.now()
        })

        await this.logAudit('BIOMETRIC_SUCCESS', employeeId, {
          biometricType: biometricData.type,
          ipAddress,
          role: employee.role
        })

        return {
          success: true,
          employee,
          role: employee.role,
          permissions: this.getPermissionsForRole(employee.role)
        }
      }

      await this.logAudit('BIOMETRIC_FAILED', employeeId, {
        biometricType: biometricData.type,
        ipAddress,
        reason: 'Invalid biometric data'
      })

      return {
        success: false,
        message: 'Biometric validation failed.'
      }

    } catch (error) {
      console.error('Biometric validation error:', error)
      await this.logAudit('BIOMETRIC_ERROR', employeeId, {
        biometricType: biometricData.type,
        ipAddress,
        error: error.message
      })
      
      return {
        success: false,
        message: 'Biometric service error. Please try again.'
      }
    }
  }

  async startShift(employeeId: string, accessCode: string, ipAddress: string): Promise<{ success: boolean; shiftId?: string; message?: string }> {
    try {
      const authResult = await this.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      // Check if employee already has an active shift
      const db = getDb()
      const existingShift = await db.collection(COLLECTIONS.SHIFTS)
        .where('employeeId', '==', employeeId)
        .where('status', '==', 'active')
        .limit(1)
        .get()

      if (!existingShift.empty) {
        return { success: false, message: 'Employee already has an active shift.' }
      }

      // Create new shift
      const shiftId = randomUUID()
      const shift = {
        id: shiftId,
        employeeId,
        startTime: Date.now(),
        status: 'active' as const,
        createdAt: Date.now()
      }

      await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).set(shift)

      // Update employee with current shift
      await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).update({
        shiftId
      })

      await this.logAudit('SHIFT_STARTED', employeeId, {
        shiftId,
        ipAddress,
        accessCode
      })

      return { success: true, shiftId }

    } catch (error) {
      console.error('Start shift error:', error)
      await this.logAudit('SHIFT_START_ERROR', employeeId, {
        ipAddress,
        accessCode,
        error: error.message
      })
      
      return { success: false, message: 'Failed to start shift. Please try again.' }
    }
  }

  async endShift(employeeId: string, accessCode: string, cashCount: number, ipAddress: string): Promise<{ success: boolean; message?: string }> {
    try {
      const authResult = await this.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      const db = getDb()
      const shiftDoc = await db.collection(COLLECTIONS.SHIFTS)
        .where('employeeId', '==', employeeId)
        .where('status', '==', 'active')
        .limit(1)
        .get()

      if (shiftDoc.empty) {
        return { success: false, message: 'No active shift found for employee.' }
      }

      const shift = shiftDoc.docs[0].data()
      const shiftId = shiftDoc.docs[0].id

      // End the shift
      await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).update({
        endTime: Date.now(),
        status: 'ended'
      })

      // Remove shift from employee
      await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).update({
        shiftId: null
      })

      await this.logAudit('SHIFT_ENDED', employeeId, {
        shiftId,
        ipAddress,
        accessCode,
        cashCount
      })

      return { success: true }

    } catch (error) {
      console.error('End shift error:', error)
      await this.logAudit('SHIFT_END_ERROR', employeeId, {
        ipAddress,
        accessCode,
        error: error.message
      })
      
      return { success: false, message: 'Failed to end shift. Please try again.' }
    }
  }

  async reconcileCash(shiftId: string, employeeId: string, accessCode: string, actualCash: number, ipAddress: string): Promise<{ success: boolean; discrepancy?: number; message?: string }> {
    try {
      const authResult = await this.validateAccessCode(employeeId, accessCode, ipAddress)
      if (!authResult.success) {
        return { success: false, message: authResult.message }
      }

      const db = getDb()
      const shiftDoc = await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).get()
      
      if (!shiftDoc.exists) {
        return { success: false, message: 'Shift not found.' }
      }

      const shift = shiftDoc.data()
      const expectedCash = shift.expectedCash || 0
      const discrepancy = Math.abs(actualCash - expectedCash)

      // Create cash reconciliation record
      const reconciliationId = randomUUID()
      await db.collection(COLLECTIONS.CASH_RECONCILIATION).doc(reconciliationId).set({
        id: reconciliationId,
        shiftId,
        employeeId,
        expectedCash,
        actualCash,
        discrepancy,
        timestamp: Date.now(),
        accessCode
      })

      // Update shift status
      await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).update({
        actualCash,
        discrepancy,
        status: 'reconciled'
      })

      // Log the reconciliation
      await this.logAudit('CASH_RECONCILED', employeeId, {
        shiftId,
        expectedCash,
        actualCash,
        discrepancy,
        ipAddress,
        accessCode
      })

      // Check for significant discrepancies
      if (discrepancy > 10) { // $10 threshold
        await this.createAlert('cash_discrepancy', 'high', `Cash discrepancy of $${discrepancy} detected for shift ${shiftId}`, {
          shiftId,
          employeeId,
          expectedCash,
          actualCash,
          discrepancy
        })
      }

      return { success: true, discrepancy }

    } catch (error) {
      console.error('Cash reconciliation error:', error)
      await this.logAudit('CASH_RECONCILIATION_ERROR', employeeId, {
        shiftId,
        ipAddress,
        accessCode,
        error: error.message
      })
      
      return { success: false, message: 'Failed to reconcile cash. Please try again.' }
    }
  }

  private getPermissionsForRole(role: string): string[] {
    const permissions = {
      'Manager': [
        'table_management', 'order_management', 'payment_processing', 'kds_management',
        'inventory_management', 'reporting', 'analytics', 'audit_logs', 'employee_management',
        'shift_management', 'cash_reconciliation', 'void_approval', 'discount_approval',
        'combo_management', 'loyalty_management', 'system_settings'
      ],
      'Cashier': [
        'table_management', 'order_management', 'payment_processing', 'basic_reporting',
        'shift_management', 'cash_reconciliation'
      ],
      'Kitchen': [
        'kds_management', 'order_viewing', 'basic_reporting'
      ],
      'Server': [
        'table_management', 'order_management', 'basic_reporting'
      ]
    }

    return permissions[role] || []
  }

  private async recordFailedAttempt(employeeId: string, accessCode: string, ipAddress: string): Promise<void> {
    const currentCount = this.failedAttempts.get(employeeId) || 0
    this.failedAttempts.set(employeeId, currentCount + 1)

    await this.logAudit('ACCESS_CODE_FAILED', employeeId, {
      accessCode,
      ipAddress,
      failedAttempts: currentCount + 1
    })
  }

  private async logAudit(actionType: string, employeeId: string, details: any): Promise<void> {
    try {
      const db = getDb()
      const auditId = randomUUID()
      
      const auditLog: AuditLog = {
        id: auditId,
        actionType,
        employeeId,
        details,
        timestamp: Date.now(),
        ipAddress: details.ipAddress || 'unknown',
        accessCode: details.accessCode || 'unknown'
      }

      await db.collection(COLLECTIONS.AUDIT_LOGS).doc(auditId).set(auditLog)
    } catch (error) {
      console.error('Failed to log audit:', error)
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
      console.error('Failed to create alert:', error)
    }
  }

  // Check if user has permission for specific action
  hasPermission(employeeId: string, permission: string): boolean {
    const validation = this.accessCodeCache.get(employeeId)
    return validation?.permissions?.includes(permission) || false
  }

  // Get cached employee info
  getCachedEmployee(employeeId: string): Employee | undefined {
    const validation = this.accessCodeCache.get(employeeId)
    return validation?.employee
  }

  // Clear cache for employee
  clearCache(employeeId: string): void {
    this.accessCodeCache.delete(employeeId)
    this.failedAttempts.delete(employeeId)
    this.lockouts.delete(employeeId)
  }
}

export const authService = AuthService.getInstance()
