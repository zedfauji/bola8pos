import { randomUUID } from 'crypto'
import { getDb } from '../config/firebaseNode'
import { Table, Employee, AuditLog, COLLECTIONS } from '../models'
import { authService } from './auth.service'
import { antiTheftService } from './antiTheftService'

export interface LightingChannel {
  id: string
  channelNumber: number
  tableId: number
  status: 'on' | 'off' | 'dimmed' | 'error'
  brightness: number // 0-100
  lastUpdated: string
  errorMessage?: string
}

export interface LightingGroup {
  id: string
  name: string
  channels: string[] // channel IDs
  defaultBrightness: number
  schedule?: {
    startTime: string // HH:MM
    endTime: string // HH:MM
    days: number[] // 0-6 (Sunday-Saturday)
  }
}

export interface LightingControl {
  channelId: string
  action: 'turnOn' | 'turnOff' | 'setBrightness' | 'dim' | 'flash'
  brightness?: number
  duration?: number // in seconds
  employeeId: string
  accessCode: string
  ipAddress: string
}

export interface LightingSchedule {
  id: string
  name: string
  channels: string[]
  schedule: {
    startTime: string
    endTime: string
    days: number[]
    brightness: number
  }
  enabled: boolean
  lastExecuted?: string
}

class LightingService {
  private static instance: LightingService
  private channels: Map<string, LightingChannel> = new Map()
  private groups: Map<string, LightingGroup> = new Map()
  private schedules: Map<string, LightingSchedule> = new Map()
  private db = getDb()

  private constructor() {
    this.initializeChannels()
  }

  public static getInstance(): LightingService {
    if (!LightingService.instance) {
      LightingService.instance = new LightingService()
    }
    return LightingService.instance
  }

  private async initializeChannels() {
    try {
      // Initialize 32 channels for billiard tables
      for (let i = 1; i <= 32; i++) {
        const channelId = `channel_${i}`
        const channel: LightingChannel = {
          id: channelId,
          channelNumber: i,
          tableId: i <= 16 ? i : 0, // First 16 channels for tables, rest for general lighting
          status: 'off',
          brightness: 0,
          lastUpdated: new Date().toISOString()
        }
        this.channels.set(channelId, channel)
      }

      // Create default groups
      const billiardGroup: LightingGroup = {
        id: 'billiard_tables',
        name: 'Billiard Tables',
        channels: Array.from({ length: 16 }, (_, i) => `channel_${i + 1}`),
        defaultBrightness: 80
      }
      this.groups.set(billiardGroup.id, billiardGroup)

      const generalGroup: LightingGroup = {
        id: 'general_lighting',
        name: 'General Lighting',
        channels: Array.from({ length: 16 }, (_, i) => `channel_${i + 17}`),
        defaultBrightness: 60
      }
      this.groups.set(generalGroup.id, generalGroup)

      // Save to Firestore
      await this.saveChannelsToFirestore()
      await this.saveGroupsToFirestore()
    } catch (error) {
      console.error('Error initializing lighting channels:', error)
    }
  }

  async controlLighting(control: LightingControl): Promise<{ success: boolean; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(control.accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      const channel = this.channels.get(control.channelId)
      if (!channel) {
        return { success: false, message: 'Channel not found' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'lighting_control')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_LIGHTING_ACCESS',
          employeeId: control.employeeId,
          details: `Attempted to control channel ${control.channelId}`,
          severity: 'high',
          ipAddress: control.ipAddress
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      // Execute lighting control
      switch (control.action) {
        case 'turnOn':
          channel.status = 'on'
          channel.brightness = control.brightness || 100
          break
        case 'turnOff':
          channel.status = 'off'
          channel.brightness = 0
          break
        case 'setBrightness':
          if (control.brightness !== undefined) {
            channel.brightness = Math.max(0, Math.min(100, control.brightness))
            channel.status = channel.brightness > 0 ? 'on' : 'off'
          }
          break
        case 'dim':
          if (control.duration) {
            // Implement gradual dimming over time
            await this.gradualDim(channel.id, control.duration)
          }
          break
        case 'flash':
          await this.flashChannel(channel.id, control.duration || 5)
          break
      }

      channel.lastUpdated = new Date().toISOString()
      this.channels.set(control.channelId, channel)

      // Log action
      await antiTheftService.logAction({
        action: 'LIGHTING_CONTROL',
        employeeId: control.employeeId,
        details: `${control.action} on channel ${control.channelId}`,
        severity: 'low',
        ipAddress: control.ipAddress
      })

      // Save to Firestore
      await this.saveChannelToFirestore(channel)

      return { success: true, message: `Lighting control executed: ${control.action}` }
    } catch (error) {
      console.error('Error controlling lighting:', error)
      return { success: false, message: 'Error controlling lighting' }
    }
  }

  async controlTableLight(tableId: number, action: 'on' | 'off' | 'dim', brightness?: number): Promise<{ success: boolean; message: string }> {
    try {
      const channelId = `channel_${tableId}`
      const channel = this.channels.get(channelId)
      
      if (!channel) {
        return { success: false, message: 'Table lighting channel not found' }
      }

      switch (action) {
        case 'on':
          channel.status = 'on'
          channel.brightness = brightness || 80
          break
        case 'off':
          channel.status = 'off'
          channel.brightness = 0
          break
        case 'dim':
          channel.brightness = brightness || 40
          channel.status = channel.brightness > 0 ? 'on' : 'off'
          break
      }

      channel.lastUpdated = new Date().toISOString()
      this.channels.set(channelId, channel)
      await this.saveChannelToFirestore(channel)

      return { success: true, message: `Table ${tableId} lighting: ${action}` }
    } catch (error) {
      console.error('Error controlling table light:', error)
      return { success: false, message: 'Error controlling table light' }
    }
  }

  async enableCleaningMode(tableId: number, duration: number = 300): Promise<{ success: boolean; message: string }> {
    try {
      const channelId = `channel_${tableId}`
      const channel = this.channels.get(channelId)
      
      if (!channel) {
        return { success: false, message: 'Table lighting channel not found' }
      }

      // Turn on lights at full brightness
      channel.status = 'on'
      channel.brightness = 100
      channel.lastUpdated = new Date().toISOString()
      this.channels.set(channelId, channel)
      await this.saveChannelToFirestore(channel)

      // Schedule automatic turn off
      setTimeout(async () => {
        await this.controlTableLight(tableId, 'off')
      }, duration * 1000)

      return { success: true, message: `Cleaning mode enabled for table ${tableId} for ${duration} seconds` }
    } catch (error) {
      console.error('Error enabling cleaning mode:', error)
      return { success: false, message: 'Error enabling cleaning mode' }
    }
  }

  async getChannelStatus(channelId: string): Promise<LightingChannel | null> {
    return this.channels.get(channelId) || null
  }

  async getAllChannels(): Promise<LightingChannel[]> {
    return Array.from(this.channels.values())
  }

  async getTableLightStatus(tableId: number): Promise<LightingChannel | null> {
    const channelId = `channel_${tableId}`
    return this.channels.get(channelId) || null
  }

  async getGroupChannels(groupId: string): Promise<LightingChannel[]> {
    const group = this.groups.get(groupId)
    if (!group) return []

    return group.channels
      .map(channelId => this.channels.get(channelId))
      .filter((channel): channel is LightingChannel => channel !== undefined)
  }

  async createLightingSchedule(schedule: Omit<LightingSchedule, 'id'>): Promise<{ success: boolean; scheduleId?: string; message: string }> {
    try {
      const scheduleId = randomUUID()
      const newSchedule: LightingSchedule = {
        ...schedule,
        id: scheduleId
      }

      this.schedules.set(scheduleId, newSchedule)
      await this.saveScheduleToFirestore(newSchedule)

      return { success: true, scheduleId, message: 'Lighting schedule created' }
    } catch (error) {
      console.error('Error creating lighting schedule:', error)
      return { success: false, message: 'Error creating lighting schedule' }
    }
  }

  async executeSchedules(): Promise<void> {
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 5)
    const currentDay = now.getDay()

    for (const schedule of this.schedules.values()) {
      if (!schedule.enabled) continue

      const { startTime, endTime, days, brightness } = schedule.schedule
      
      if (days.includes(currentDay) && currentTime >= startTime && currentTime <= endTime) {
        // Execute schedule
        for (const channelId of schedule.channels) {
          const channel = this.channels.get(channelId)
          if (channel) {
            channel.status = 'on'
            channel.brightness = brightness
            channel.lastUpdated = now.toISOString()
            this.channels.set(channelId, channel)
            await this.saveChannelToFirestore(channel)
          }
        }

        schedule.lastExecuted = now.toISOString()
        await this.saveScheduleToFirestore(schedule)
      }
    }
  }

  private async gradualDim(channelId: string, duration: number): Promise<void> {
    const channel = this.channels.get(channelId)
    if (!channel) return

    const steps = 10
    const stepDuration = duration / steps
    const brightnessStep = channel.brightness / steps

    for (let i = 0; i < steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration * 1000))
      channel.brightness = Math.max(0, channel.brightness - brightnessStep)
      channel.status = channel.brightness > 0 ? 'on' : 'off'
      channel.lastUpdated = new Date().toISOString()
      this.channels.set(channelId, channel)
      await this.saveChannelToFirestore(channel)
    }
  }

  private async flashChannel(channelId: string, duration: number): Promise<void> {
    const channel = this.channels.get(channelId)
    if (!channel) return

    const originalStatus = channel.status
    const originalBrightness = channel.brightness

    // Flash on
    channel.status = 'on'
    channel.brightness = 100
    this.channels.set(channelId, channel)
    await this.saveChannelToFirestore(channel)

    // Flash off after duration
    setTimeout(async () => {
      channel.status = originalStatus
      channel.brightness = originalBrightness
      channel.lastUpdated = new Date().toISOString()
      this.channels.set(channelId, channel)
      await this.saveChannelToFirestore(channel)
    }, duration * 1000)
  }

  // Firestore integration methods
  private async saveChannelsToFirestore(): Promise<void> {
    try {
      const batch = this.db.batch()
      for (const channel of this.channels.values()) {
        const docRef = this.db.collection(COLLECTIONS.LIGHTING_CHANNELS).doc(channel.id)
        batch.set(docRef, channel)
      }
      await batch.commit()
    } catch (error) {
      console.error('Error saving channels to Firestore:', error)
    }
  }

  private async saveChannelToFirestore(channel: LightingChannel): Promise<void> {
    try {
      await this.db.collection(COLLECTIONS.LIGHTING_CHANNELS).doc(channel.id).set(channel)
    } catch (error) {
      console.error('Error saving channel to Firestore:', error)
    }
  }

  private async saveGroupsToFirestore(): Promise<void> {
    try {
      const batch = this.db.batch()
      for (const group of this.groups.values()) {
        const docRef = this.db.collection(COLLECTIONS.LIGHTING_GROUPS).doc(group.id)
        batch.set(docRef, group)
      }
      await batch.commit()
    } catch (error) {
      console.error('Error saving groups to Firestore:', error)
    }
  }

  private async saveScheduleToFirestore(schedule: LightingSchedule): Promise<void> {
    try {
      await this.db.collection(COLLECTIONS.LIGHTING_SCHEDULES).doc(schedule.id).set(schedule)
    } catch (error) {
      console.error('Error saving schedule to Firestore:', error)
    }
  }
}

export const lightingService = LightingService.getInstance()
