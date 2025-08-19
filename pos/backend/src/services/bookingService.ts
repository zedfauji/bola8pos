import { randomUUID } from 'crypto'
import { getDb } from '../config/firebaseNode'
import { Table, Customer, Employee, AuditLog, COLLECTIONS } from '../models'
import { authService } from './auth.service'
import { antiTheftService } from './antiTheftService'

export interface Booking {
  id: string
  tableId: number
  customerId?: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  startTime: string // ISO string
  endTime: string // ISO string
  duration: number // in minutes
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show'
  notes?: string
  specialRequests?: string[]
  numberOfPeople?: number
  isRecurring: boolean
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    interval: number
    endDate?: string
    daysOfWeek?: number[] // 0-6 (Sunday-Saturday)
  }
  createdAt: string
  updatedAt: string
  createdBy: string
  confirmedBy?: string
  confirmationTime?: string
}

export interface BookingRequest {
  tableId: number
  customerName: string
  customerPhone?: string
  customerEmail?: string
  startTime: string
  endTime: string
  notes?: string
  specialRequests?: string[]
  numberOfPeople?: number
  isRecurring?: boolean
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    interval: number
    endDate?: string
    daysOfWeek?: number[]
  }
  employeeId: string
  accessCode: string
  ipAddress: string
}

export interface BookingConflict {
  tableId: number
  conflictingBookings: string[]
  conflictType: 'overlap' | 'maintenance' | 'unavailable'
  message: string
}

export interface BookingCalendar {
  date: string
  tableBookings: {
    [tableId: number]: {
      timeSlots: {
        [timeSlot: string]: Booking[]
      }
    }
  }
}

export interface TimeSlot {
  startTime: string
  endTime: string
  isAvailable: boolean
  conflictingBookings: string[]
}

class BookingService {
  private static instance: BookingService
  private bookings: Map<string, Booking> = new Map()
  private db = getDb()

  private constructor() {}

  public static getInstance(): BookingService {
    if (!BookingService.instance) {
      BookingService.instance = new BookingService()
    }
    return BookingService.instance
  }

  async createBooking(bookingData: BookingRequest): Promise<{ success: boolean; bookingId?: string; conflicts?: BookingConflict[]; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(bookingData.accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'booking_management')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_BOOKING_ACCESS',
          employeeId: bookingData.employeeId,
          details: 'Attempted to create booking without permission',
          severity: 'high',
          ipAddress: bookingData.ipAddress
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      // Validate booking data
      if (!this.validateBookingData(bookingData)) {
        return { success: false, message: 'Invalid booking data' }
      }

      // Check for conflicts
      const conflicts = await this.checkBookingConflicts(bookingData.tableId, bookingData.startTime, bookingData.endTime)
      if (conflicts.length > 0) {
        return { 
          success: false, 
          conflicts: conflicts.map(conflict => ({
            tableId: conflict.tableId,
            conflictingBookings: conflict.conflictingBookings,
            conflictType: conflict.conflictType,
            message: conflict.message
          })),
          message: 'Booking conflicts detected' 
        }
      }

      const bookingId = randomUUID()
      const now = new Date().toISOString()
      const startTime = new Date(bookingData.startTime)
      const endTime = new Date(bookingData.endTime)
      const duration = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60))

      const newBooking: Booking = {
        id: bookingId,
        tableId: bookingData.tableId,
        customerName: bookingData.customerName,
        customerPhone: bookingData.customerPhone,
        customerEmail: bookingData.customerEmail,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        duration,
        status: 'confirmed',
        notes: bookingData.notes,
        specialRequests: bookingData.specialRequests,
        numberOfPeople: bookingData.numberOfPeople,
        isRecurring: bookingData.isRecurring || false,
        recurringPattern: bookingData.recurringPattern,
        createdAt: now,
        updatedAt: now,
        createdBy: bookingData.employeeId,
        confirmedBy: bookingData.employeeId,
        confirmationTime: now
      }

      this.bookings.set(bookingId, newBooking)

      // Create recurring bookings if applicable
      if (newBooking.isRecurring && newBooking.recurringPattern) {
        await this.createRecurringBookings(newBooking)
      }

      // Log action
      await antiTheftService.logAction({
        action: 'BOOKING_CREATED',
        employeeId: bookingData.employeeId,
        details: `Created booking for table ${bookingData.tableId} at ${startTime.toLocaleString()}`,
        severity: 'low',
        ipAddress: bookingData.ipAddress
      })

      // Save to Firestore
      await this.saveBookingToFirestore(newBooking)

      return { success: true, bookingId, message: 'Booking created successfully' }
    } catch (error) {
      console.error('Error creating booking:', error)
      return { success: false, message: 'Error creating booking' }
    }
  }

  async updateBooking(bookingId: string, updates: Partial<Booking>, employeeId: string, accessCode: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'booking_management')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_BOOKING_ACCESS',
          employeeId,
          details: `Attempted to update booking ${bookingId} without permission`,
          severity: 'high',
          ipAddress: 'unknown'
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      const booking = this.bookings.get(bookingId)
      if (!booking) {
        return { success: false, message: 'Booking not found' }
      }

      // Check for conflicts if time is being changed
      if (updates.startTime || updates.endTime) {
        const startTime = updates.startTime || booking.startTime
        const endTime = updates.endTime || booking.endTime
        const conflicts = await this.checkBookingConflicts(booking.tableId, startTime, endTime, [bookingId])
        
        if (conflicts.length > 0) {
          return { success: false, message: 'Updated time conflicts with existing bookings' }
        }
      }

      // Update booking
      const updatedBooking: Booking = {
        ...booking,
        ...updates,
        updatedAt: new Date().toISOString()
      }

      this.bookings.set(bookingId, updatedBooking)

      // Log action
      await antiTheftService.logAction({
        action: 'BOOKING_UPDATED',
        employeeId,
        details: `Updated booking: ${bookingId}`,
        severity: 'low',
        ipAddress: 'unknown'
      })

      // Save to Firestore
      await this.saveBookingToFirestore(updatedBooking)

      return { success: true, message: 'Booking updated successfully' }
    } catch (error) {
      console.error('Error updating booking:', error)
      return { success: false, message: 'Error updating booking' }
    }
  }

  async cancelBooking(bookingId: string, reason: string, employeeId: string, accessCode: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'booking_management')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_BOOKING_ACCESS',
          employeeId,
          details: `Attempted to cancel booking ${bookingId} without permission`,
          severity: 'high',
          ipAddress: 'unknown'
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      const booking = this.bookings.get(bookingId)
      if (!booking) {
        return { success: false, message: 'Booking not found' }
      }

      if (booking.status === 'cancelled') {
        return { success: false, message: 'Booking is already cancelled' }
      }

      // Update booking status
      booking.status = 'cancelled'
      booking.notes = `${booking.notes || ''}\nCancelled: ${reason}`
      booking.updatedAt = new Date().toISOString()

      this.bookings.set(bookingId, booking)

      // Log action
      await antiTheftService.logAction({
        action: 'BOOKING_CANCELLED',
        employeeId,
        details: `Cancelled booking: ${bookingId}. Reason: ${reason}`,
        severity: 'medium',
        ipAddress: 'unknown'
      })

      // Save to Firestore
      await this.saveBookingToFirestore(booking)

      return { success: true, message: 'Booking cancelled successfully' }
    } catch (error) {
      console.error('Error cancelling booking:', error)
      return { success: false, message: 'Error cancelling booking' }
    }
  }

  async getBookingsByDate(date: string): Promise<Booking[]> {
    const targetDate = new Date(date)
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

    return Array.from(this.bookings.values()).filter(booking => {
      const bookingStart = new Date(booking.startTime)
      const bookingEnd = new Date(booking.endTime)
      
      return (
        (bookingStart >= startOfDay && bookingStart <= endOfDay) ||
        (bookingEnd >= startOfDay && bookingEnd <= endOfDay) ||
        (bookingStart <= startOfDay && bookingEnd >= endOfDay)
      )
    })
  }

  async getBookingsByTable(tableId: number, date?: string): Promise<Booking[]> {
    let bookings = Array.from(this.bookings.values()).filter(booking => booking.tableId === tableId)
    
    if (date) {
      const targetDate = new Date(date)
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))
      
      bookings = bookings.filter(booking => {
        const bookingStart = new Date(booking.startTime)
        const bookingEnd = new Date(booking.endTime)
        
        return (
          (bookingStart >= startOfDay && bookingStart <= endOfDay) ||
          (bookingEnd >= startOfDay && bookingEnd <= endOfDay) ||
          (bookingStart <= startOfDay && bookingEnd >= endOfDay)
        )
      })
    }

    return bookings
  }

  async getBookingCalendar(date: string): Promise<BookingCalendar> {
    const bookings = await this.getBookingsByDate(date)
    const calendar: BookingCalendar = {
      date,
      tableBookings: {}
    }

    // Group bookings by table
    for (const booking of bookings) {
      if (!calendar.tableBookings[booking.tableId]) {
        calendar.tableBookings[booking.tableId] = { timeSlots: {} }
      }

      const timeSlot = `${booking.startTime.slice(11, 16)}-${booking.endTime.slice(11, 16)}`
      if (!calendar.tableBookings[booking.tableId].timeSlots[timeSlot]) {
        calendar.tableBookings[booking.tableId].timeSlots[timeSlot] = []
      }

      calendar.tableBookings[booking.tableId].timeSlots[timeSlot].push(booking)
    }

    return calendar
  }

  async getAvailableTimeSlots(tableId: number, date: string, duration: number = 60): Promise<TimeSlot[]> {
    const targetDate = new Date(date)
    const startOfDay = new Date(targetDate.setHours(10, 0, 0, 0)) // 10:00 AM
    const endOfDay = new Date(targetDate.setHours(23, 0, 0, 0))   // 11:00 PM
    
    const timeSlots: TimeSlot[] = []
    const interval = 30 // 30-minute intervals
    
    for (let time = startOfDay.getTime(); time < endOfDay.getTime(); time += interval * 60 * 1000) {
      const slotStart = new Date(time)
      const slotEnd = new Date(time + duration * 60 * 1000)
      
      if (slotEnd > endOfDay) break
      
      const conflicts = await this.checkBookingConflicts(tableId, slotStart.toISOString(), slotEnd.toISOString())
      const isAvailable = conflicts.length === 0
      
      timeSlots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        isAvailable,
        conflictingBookings: conflicts.map(c => c.conflictingBookings).flat()
      })
    }
    
    return timeSlots
  }

  async getUpcomingBookings(limit: number = 10): Promise<Booking[]> {
    const now = new Date()
    const upcomingBookings = Array.from(this.bookings.values())
      .filter(booking => 
        new Date(booking.startTime) > now && 
        booking.status === 'confirmed'
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, limit)
    
    return upcomingBookings
  }

  async getCustomerBookings(customerId: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(booking => 
      booking.customerId === customerId
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  private async checkBookingConflicts(tableId: number, startTime: string, endTime: string, excludeBookingIds: string[] = []): Promise<Array<{ tableId: number; conflictingBookings: string[]; conflictType: string; message: string }>> {
    const conflicts: Array<{ tableId: number; conflictingBookings: string[]; conflictType: string; message: string }> = []
    
    const newStart = new Date(startTime)
    const newEnd = new Date(endTime)
    
    // Check for overlapping bookings
    const overlappingBookings = Array.from(this.bookings.values()).filter(booking => {
      if (excludeBookingIds.includes(booking.id)) return false
      if (booking.tableId !== tableId) return false
      if (booking.status === 'cancelled') return false
      
      const existingStart = new Date(booking.startTime)
      const existingEnd = new Date(booking.endTime)
      
      return (
        (newStart < existingEnd && newEnd > existingStart) ||
        (existingStart < newEnd && existingEnd > newStart)
      )
    })
    
    if (overlappingBookings.length > 0) {
      conflicts.push({
        tableId,
        conflictingBookings: overlappingBookings.map(b => b.id),
        conflictType: 'overlap',
        message: `Conflicts with ${overlappingBookings.length} existing booking(s)`
      })
    }
    
    return conflicts
  }

  private async createRecurringBookings(originalBooking: Booking): Promise<void> {
    if (!originalBooking.recurringPattern) return
    
    const { frequency, interval, endDate, daysOfWeek } = originalBooking.recurringPattern
    const startDate = new Date(originalBooking.startTime)
    const endDateObj = endDate ? new Date(endDate) : new Date(startDate.getTime() + (365 * 24 * 60 * 60 * 1000)) // Default to 1 year
    
    let currentDate = new Date(startDate)
    let count = 0
    const maxRecurring = 52 // Limit to prevent infinite loops
    
    while (currentDate < endDateObj && count < maxRecurring) {
      count++
      
      // Calculate next occurrence
      switch (frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + interval)
          break
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (7 * interval))
          break
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + interval)
          break
      }
      
      // Check if day of week is valid for weekly recurring
      if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
        if (!daysOfWeek.includes(currentDate.getDay())) {
          continue
        }
      }
      
      // Create recurring booking
      const recurringStart = new Date(currentDate)
      recurringStart.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0)
      
      const recurringEnd = new Date(recurringStart.getTime() + (originalBooking.duration * 60 * 1000))
      
      const recurringBooking: Booking = {
        ...originalBooking,
        id: randomUUID(),
        startTime: recurringStart.toISOString(),
        endTime: recurringEnd.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'confirmed'
      }
      
      this.bookings.set(recurringBooking.id, recurringBooking)
      await this.saveBookingToFirestore(recurringBooking)
    }
  }

  private validateBookingData(bookingData: BookingRequest): boolean {
    if (!bookingData.tableId || !bookingData.customerName || !bookingData.startTime || !bookingData.endTime) {
      return false
    }
    
    const startTime = new Date(bookingData.startTime)
    const endTime = new Date(bookingData.endTime)
    
    if (startTime >= endTime) {
      return false
    }
    
    if (startTime < new Date()) {
      return false
    }
    
    return true
  }

  // Firestore integration methods
  private async saveBookingToFirestore(booking: Booking): Promise<void> {
    try {
      await this.db.collection(COLLECTIONS.BOOKINGS).doc(booking.id).set(booking)
    } catch (error) {
      console.error('Error saving booking to Firestore:', error)
    }
  }
}

export const bookingService = BookingService.getInstance()
