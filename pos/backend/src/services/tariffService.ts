import { randomUUID } from 'crypto'
import { getDb } from '../config/firebaseNode'
import { Employee, AuditLog, COLLECTIONS } from '../models'
import { authService } from './auth.service'
import { antiTheftService } from './antiTheftService'

export interface Tariff {
  id: string
  name: string
  groupId: string
  type: 'per_hour' | 'per_session' | 'fixed'
  basePrice: number
  currency: string
  timeRestrictions?: {
    startTime: string // HH:MM
    endTime: string // HH:MM
    days: number[] // 0-6 (Sunday-Saturday)
  }
  specialPricing?: {
    [key: string]: number // e.g., "weekend": 15.00
  }
  minDuration?: number // in minutes
  maxDuration?: number // in minutes
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface TariffGroup {
  id: string
  name: string
  description?: string
  tableTypes: ('Billiard' | 'Normal' | 'La Barra')[]
  defaultTariffId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TariffCalculation {
  tariffId: string
  basePrice: number
  duration: number // in minutes
  totalPrice: number
  appliedDiscounts: string[]
  finalPrice: number
  currency: string
}

export interface TariffRestriction {
  id: string
  tariffId: string
  type: 'time' | 'day' | 'seasonal' | 'capacity'
  value: string | number
  description: string
  isActive: boolean
}

class TariffService {
  private static instance: TariffService
  private tariffs: Map<string, Tariff> = new Map()
  private groups: Map<string, TariffGroup> = new Map()
  private restrictions: Map<string, TariffRestriction> = new Map()
  private db = getDb()

  private constructor() {
    this.initializeDefaultTariffs()
  }

  public static getInstance(): TariffService {
    if (!TariffService.instance) {
      TariffService.instance = new TariffService()
    }
    return TariffService.instance
  }

  private async initializeDefaultTariffs() {
    try {
      // Create default tariff groups
      const vipGroup: TariffGroup = {
        id: 'vip_group',
        name: 'VIP',
        description: 'Premium tables with enhanced services',
        tableTypes: ['Billiard'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const hallGroup: TariffGroup = {
        id: 'hall_group',
        name: 'Hall',
        description: 'Standard billiard tables',
        tableTypes: ['Billiard'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const promotionGroup: TariffGroup = {
        id: 'promotion_group',
        name: 'Promotion',
        description: 'Special promotional rates',
        tableTypes: ['Billiard', 'Normal'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      this.groups.set(vipGroup.id, vipGroup)
      this.groups.set(hallGroup.id, hallGroup)
      this.groups.set(promotionGroup.id, promotionGroup)

      // Create default tariffs
      const vipTariff: Tariff = {
        id: 'vip_standard',
        name: 'VIP Standard',
        groupId: vipGroup.id,
        type: 'per_hour',
        basePrice: 25.00,
        currency: 'USD',
        timeRestrictions: {
          startTime: '10:00',
          endTime: '23:00',
          days: [1, 2, 3, 4, 5, 6, 0] // All days
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      }

      const hallTariff: Tariff = {
        id: 'hall_standard',
        name: 'Hall Standard',
        groupId: hallGroup.id,
        type: 'per_hour',
        basePrice: 18.00,
        currency: 'USD',
        timeRestrictions: {
          startTime: '10:00',
          endTime: '23:00',
          days: [1, 2, 3, 4, 5, 6, 0] // All days
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      }

      const promotionTariff: Tariff = {
        id: 'promotion_weekend',
        name: 'Weekend Promotion',
        groupId: promotionGroup.id,
        type: 'per_hour',
        basePrice: 12.00,
        currency: 'USD',
        timeRestrictions: {
          startTime: '10:00',
          endTime: '18:00',
          days: [0, 6] // Saturday and Sunday
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      }

      this.tariffs.set(vipTariff.id, vipTariff)
      this.tariffs.set(hallTariff.id, hallTariff)
      this.tariffs.set(promotionTariff.id, promotionTariff)

      // Set default tariffs for groups
      vipGroup.defaultTariffId = vipTariff.id
      hallGroup.defaultTariffId = hallTariff.id
      promotionGroup.defaultTariffId = promotionTariff.id

      // Save to Firestore
      await this.saveGroupsToFirestore()
      await this.saveTariffsToFirestore()
    } catch (error) {
      console.error('Error initializing default tariffs:', error)
    }
  }

  async createTariff(tariffData: Omit<Tariff, 'id' | 'createdAt' | 'updatedAt'>, employeeId: string, accessCode: string): Promise<{ success: boolean; tariffId?: string; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'tariff_management')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_TARIFF_ACCESS',
          employeeId,
          details: 'Attempted to create tariff without permission',
          severity: 'high',
          ipAddress: 'unknown'
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      // Validate tariff data
      if (!this.validateTariffData(tariffData)) {
        return { success: false, message: 'Invalid tariff data' }
      }

      const tariffId = randomUUID()
      const now = new Date().toISOString()
      
      const newTariff: Tariff = {
        ...tariffData,
        id: tariffId,
        createdAt: now,
        updatedAt: now
      }

      this.tariffs.set(tariffId, newTariff)

      // Log action
      await antiTheftService.logAction({
        action: 'TARIFF_CREATED',
        employeeId,
        details: `Created tariff: ${newTariff.name}`,
        severity: 'low',
        ipAddress: 'unknown'
      })

      // Save to Firestore
      await this.saveTariffToFirestore(newTariff)

      return { success: true, tariffId, message: 'Tariff created successfully' }
    } catch (error) {
      console.error('Error creating tariff:', error)
      return { success: false, message: 'Error creating tariff' }
    }
  }

  async updateTariff(tariffId: string, updates: Partial<Tariff>, employeeId: string, accessCode: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'tariff_management')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_TARIFF_ACCESS',
          employeeId,
          details: `Attempted to update tariff ${tariffId} without permission`,
          severity: 'high',
          ipAddress: 'unknown'
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      const tariff = this.tariffs.get(tariffId)
      if (!tariff) {
        return { success: false, message: 'Tariff not found' }
      }

      // Update tariff
      const updatedTariff: Tariff = {
        ...tariff,
        ...updates,
        updatedAt: new Date().toISOString()
      }

      this.tariffs.set(tariffId, updatedTariff)

      // Log action
      await antiTheftService.logAction({
        action: 'TARIFF_UPDATED',
        employeeId,
        details: `Updated tariff: ${updatedTariff.name}`,
        severity: 'low',
        ipAddress: 'unknown'
      })

      // Save to Firestore
      await this.saveTariffToFirestore(updatedTariff)

      return { success: true, message: 'Tariff updated successfully' }
    } catch (error) {
      console.error('Error updating tariff:', error)
      return { success: false, message: 'Error updating tariff' }
    }
  }

  async deleteTariff(tariffId: string, employeeId: string, accessCode: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'tariff_management')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_TARIFF_ACCESS',
          employeeId,
          details: `Attempted to delete tariff ${tariffId} without permission`,
          severity: 'high',
          ipAddress: 'unknown'
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      const tariff = this.tariffs.get(tariffId)
      if (!tariff) {
        return { success: false, message: 'Tariff not found' }
      }

      // Check if tariff is in use
      if (this.isTariffInUse(tariffId)) {
        return { success: false, message: 'Cannot delete tariff that is currently in use' }
      }

      this.tariffs.delete(tariffId)

      // Log action
      await antiTheftService.logAction({
        action: 'TARIFF_DELETED',
        employeeId,
        details: `Deleted tariff: ${tariff.name}`,
        severity: 'medium',
        ipAddress: 'unknown'
      })

      // Delete from Firestore
      await this.deleteTariffFromFirestore(tariffId)

      return { success: true, message: 'Tariff deleted successfully' }
    } catch (error) {
      console.error('Error deleting tariff:', error)
      return { success: false, message: 'Error deleting tariff' }
    }
  }

  async calculatePrice(tariffId: string, duration: number, startTime?: Date): Promise<TariffCalculation | null> {
    try {
      const tariff = this.tariffs.get(tariffId)
      if (!tariff || !tariff.isActive) {
        return null
      }

      // Check time restrictions
      if (tariff.timeRestrictions && startTime) {
        if (!this.isWithinTimeRestrictions(tariff.timeRestrictions, startTime)) {
          return null
        }
      }

      let basePrice = tariff.basePrice
      let appliedDiscounts: string[] = []

      // Apply special pricing if applicable
      if (tariff.specialPricing && startTime) {
        const specialPrice = this.getSpecialPrice(tariff.specialPricing, startTime)
        if (specialPrice !== null) {
          basePrice = specialPrice
          appliedDiscounts.push('Special pricing applied')
        }
      }

      // Calculate total price based on type
      let totalPrice = 0
      switch (tariff.type) {
        case 'per_hour':
          totalPrice = (basePrice / 60) * duration
          break
        case 'per_session':
          totalPrice = basePrice
          break
        case 'fixed':
          totalPrice = basePrice
          break
      }

      // Apply minimum duration pricing
      if (tariff.minDuration && duration < tariff.minDuration) {
        totalPrice = (basePrice / 60) * tariff.minDuration
        appliedDiscounts.push('Minimum duration applied')
      }

      // Apply maximum duration pricing
      if (tariff.maxDuration && duration > tariff.maxDuration) {
        totalPrice = (basePrice / 60) * tariff.maxDuration
        appliedDiscounts.push('Maximum duration applied')
      }

      const calculation: TariffCalculation = {
        tariffId,
        basePrice,
        duration,
        totalPrice,
        appliedDiscounts,
        finalPrice: totalPrice,
        currency: tariff.currency
      }

      return calculation
    } catch (error) {
      console.error('Error calculating price:', error)
      return null
    }
  }

  async getTariffsByGroup(groupId: string): Promise<Tariff[]> {
    return Array.from(this.tariffs.values()).filter(tariff => tariff.groupId === groupId && tariff.isActive)
  }

  async getTariffById(tariffId: string): Promise<Tariff | null> {
    return this.tariffs.get(tariffId) || null
  }

  async getAllTariffs(): Promise<Tariff[]> {
    return Array.from(this.tariffs.values())
  }

  async getTariffGroups(): Promise<TariffGroup[]> {
    return Array.from(this.groups.values())
  }

  async getTariffGroupById(groupId: string): Promise<TariffGroup | null> {
    return this.groups.get(groupId) || null
  }

  async getApplicableTariffs(tableType: 'Billiard' | 'Normal' | 'La Barra', startTime?: Date): Promise<Tariff[]> {
    const applicableTariffs: Tariff[] = []

    for (const group of this.groups.values()) {
      if (group.isActive && group.tableTypes.includes(tableType)) {
        const groupTariffs = await this.getTariffsByGroup(group.id)
        
        for (const tariff of groupTariffs) {
          if (tariff.isActive) {
            if (startTime && tariff.timeRestrictions) {
              if (this.isWithinTimeRestrictions(tariff.timeRestrictions, startTime)) {
                applicableTariffs.push(tariff)
              }
            } else {
              applicableTariffs.push(tariff)
            }
          }
        }
      }
    }

    return applicableTariffs
  }

  private validateTariffData(tariffData: Omit<Tariff, 'id' | 'createdAt' | 'updatedAt'>): boolean {
    if (!tariffData.name || !tariffData.groupId || !tariffData.type || tariffData.basePrice <= 0) {
      return false
    }

    if (tariffData.timeRestrictions) {
      const { startTime, endTime, days } = tariffData.timeRestrictions
      if (!startTime || !endTime || !days || days.length === 0) {
        return false
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return false
      }

      // Validate days (0-6)
      if (!days.every(day => day >= 0 && day <= 6)) {
        return false
      }
    }

    return true
  }

  private isWithinTimeRestrictions(restrictions: NonNullable<Tariff['timeRestrictions']>, startTime: Date): boolean {
    const currentDay = startTime.getDay()
    if (!restrictions.days.includes(currentDay)) {
      return false
    }

    const currentTime = startTime.toTimeString().slice(0, 5)
    return currentTime >= restrictions.startTime && currentTime <= restrictions.endTime
  }

  private getSpecialPrice(specialPricing: NonNullable<Tariff['specialPricing']>, startTime: Date): number | null {
    const currentDay = startTime.getDay()
    const isWeekend = currentDay === 0 || currentDay === 6

    if (isWeekend && 'weekend' in specialPricing) {
      return specialPricing.weekend
    }

    // Add more special pricing logic as needed
    return null
  }

  private isTariffInUse(tariffId: string): boolean {
    // This would check if the tariff is currently being used by any active sessions
    // For now, return false to allow deletion
    return false
  }

  // Firestore integration methods
  private async saveTariffsToFirestore(): Promise<void> {
    try {
      const batch = this.db.batch()
      for (const tariff of this.tariffs.values()) {
        const docRef = this.db.collection(COLLECTIONS.TARIFFS).doc(tariff.id)
        batch.set(docRef, tariff)
      }
      await batch.commit()
    } catch (error) {
      console.error('Error saving tariffs to Firestore:', error)
    }
  }

  private async saveTariffToFirestore(tariff: Tariff): Promise<void> {
    try {
      await this.db.collection(COLLECTIONS.TARIFFS).doc(tariff.id).set(tariff)
    } catch (error) {
      console.error('Error saving tariff to Firestore:', error)
    }
  }

  private async deleteTariffFromFirestore(tariffId: string): Promise<void> {
    try {
      await this.db.collection(COLLECTIONS.TARIFFS).doc(tariffId).delete()
    } catch (error) {
      console.error('Error deleting tariff from Firestore:', error)
    }
  }

  private async saveGroupsToFirestore(): Promise<void> {
    try {
      const batch = this.db.batch()
      for (const group of this.groups.values()) {
        const docRef = this.db.collection(COLLECTIONS.TARIFF_GROUPS).doc(group.id)
        batch.set(docRef, group)
      }
      await batch.commit()
    } catch (error) {
      console.error('Error saving tariff groups to Firestore:', error)
    }
  }
}

export const tariffService = TariffService.getInstance()
