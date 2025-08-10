import { randomUUID } from 'crypto'
import { getDb } from '../config/firebaseNode'
import { Order, Employee, Customer, Transaction, COLLECTIONS } from '../models'
import { authService } from './auth.service'
import { antiTheftService } from './antiTheftService'

export interface Receipt {
  id: string
  orderId: string
  transactionId: string
  receiptNumber: string
  customerId?: string
  customerName?: string
  tableId?: number
  items: ReceiptItem[]
  subtotal: number
  tax: number
  discounts: number
  total: number
  currency: string
  paymentMethod: string
  employeeId: string
  employeeName: string
  timestamp: string
  printCount: number
  lastPrintedAt?: string
  isVoid: boolean
  voidReason?: string
  voidedBy?: string
  voidedAt?: string
}

export interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  modifiers?: string[]
  notes?: string
}

export interface ReceiptTemplate {
  id: string
  name: string
  type: '58mm' | '80mm' | 'thermal' | 'pdf'
  header: string
  footer: string
  logo?: string
  fontSize: 'small' | 'medium' | 'large'
  includeLogo: boolean
  includeQR: boolean
  includeBarcode: boolean
  customFields: string[]
  isActive: boolean
}

export interface PrintRequest {
  receiptId: string
  printerId: string
  copies: number
  employeeId: string
  accessCode: string
  ipAddress: string
}

export interface PrinterConfig {
  id: string
  name: string
  type: '58mm' | '80mm' | 'thermal' | 'network'
  connection: 'usb' | 'network' | 'bluetooth'
  ipAddress?: string
  port?: number
  model?: string
  isActive: boolean
  defaultTemplate?: string
  paperWidth: number // in mm
  maxLineLength: number
}

export interface ReceiptData {
  businessName: string
  businessAddress: string
  businessPhone: string
  businessEmail?: string
  businessWebsite?: string
  taxId?: string
  orderNumber: string
  tableNumber?: number
  customerName?: string
  items: ReceiptItem[]
  subtotal: number
  tax: number
  discounts: number
  total: number
  paymentMethod: string
  employeeName: string
  timestamp: string
  receiptNumber: string
}

class ReceiptService {
  private static instance: ReceiptService
  private receipts: Map<string, Receipt> = new Map()
  private templates: Map<string, ReceiptTemplate> = new Map()
  private printers: Map<string, PrinterConfig> = new Map()
  private db = getDb()

  private constructor() {
    this.initializeDefaultTemplates()
    this.initializeDefaultPrinters()
  }

  public static getInstance(): ReceiptService {
    if (!ReceiptService.instance) {
      ReceiptService.instance = new ReceiptService()
    }
    return ReceiptService.instance
  }

  private async initializeDefaultTemplates() {
    try {
      // 58mm receipt template
      const template58mm: ReceiptTemplate = {
        id: 'template_58mm',
        name: 'Standard 58mm',
        type: '58mm',
        header: 'BILLIARD POS\n123 Main Street\nPhone: (555) 123-4567',
        footer: 'Thank you for playing!\nVisit us again soon.',
        fontSize: 'small',
        includeLogo: false,
        includeQR: true,
        includeBarcode: true,
        customFields: ['business_name', 'address', 'phone'],
        isActive: true
      }

      // 80mm receipt template
      const template80mm: ReceiptTemplate = {
        id: 'template_80mm',
        name: 'Standard 80mm',
        type: '80mm',
        header: 'BILLIARD POS\n123 Main Street\nCity, State 12345\nPhone: (555) 123-4567\nEmail: info@billiardpos.com',
        footer: 'Thank you for choosing Billiard POS!\nWe appreciate your business.\nVisit our website: www.billiardpos.com',
        fontSize: 'medium',
        includeLogo: true,
        includeQR: true,
        includeBarcode: true,
        customFields: ['business_name', 'address', 'phone', 'email', 'website'],
        isActive: true
      }

      this.templates.set(template58mm.id, template58mm)
      this.templates.set(template80mm.id, template80mm)

      // Save to Firestore
      await this.saveTemplatesToFirestore()
    } catch (error) {
      console.error('Error initializing default templates:', error)
    }
  }

  private async initializeDefaultPrinters() {
    try {
      // Default 58mm printer
      const printer58mm: PrinterConfig = {
        id: 'printer_58mm',
        name: '58mm Thermal Printer',
        type: '58mm',
        connection: 'usb',
        isActive: true,
        defaultTemplate: 'template_58mm',
        paperWidth: 58,
        maxLineLength: 32
      }

      // Default 80mm printer
      const printer80mm: PrinterConfig = {
        id: 'printer_80mm',
        name: '80mm Thermal Printer',
        type: '80mm',
        connection: 'usb',
        isActive: true,
        defaultTemplate: 'template_80mm',
        paperWidth: 80,
        maxLineLength: 48
      }

      this.printers.set(printer58mm.id, printer58mm)
      this.printers.set(printer80mm.id, printer80mm)

      // Save to Firestore
      await this.savePrintersToFirestore()
    } catch (error) {
      console.error('Error initializing default printers:', error)
    }
  }

  async generateReceipt(orderId: string, transactionId: string, employeeId: string, accessCode: string): Promise<{ success: boolean; receiptId?: string; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'receipt_management')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_RECEIPT_ACCESS',
          employeeId,
          details: 'Attempted to generate receipt without permission',
          severity: 'high',
          ipAddress: 'unknown'
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      // Get order and transaction data (this would come from your order and payment services)
      const order = await this.getOrderData(orderId)
      const transaction = await this.getTransactionData(transactionId)
      
      if (!order || !transaction) {
        return { success: false, message: 'Order or transaction not found' }
      }

      const receiptId = randomUUID()
      const now = new Date().toISOString()
      const receiptNumber = this.generateReceiptNumber()

      // Convert order items to receipt items
      const receiptItems: ReceiptItem[] = order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity,
        modifiers: item.modifiers,
        notes: item.notes
      }))

      const receipt: Receipt = {
        id: receiptId,
        orderId,
        transactionId,
        receiptNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        tableId: order.tableId,
        items: receiptItems,
        subtotal: order.subtotal,
        tax: order.tax || 0,
        discounts: order.discounts || 0,
        total: order.total,
        currency: order.currency || 'USD',
        paymentMethod: transaction.paymentMethod,
        employeeId,
        employeeName: authResult.employee.name,
        timestamp: now,
        printCount: 0,
        isVoid: false
      }

      this.receipts.set(receiptId, receipt)

      // Log action
      await antiTheftService.logAction({
        action: 'RECEIPT_GENERATED',
        employeeId,
        details: `Generated receipt ${receiptNumber} for order ${orderId}`,
        severity: 'low',
        ipAddress: 'unknown'
      })

      // Save to Firestore
      await this.saveReceiptToFirestore(receipt)

      return { success: true, receiptId, message: 'Receipt generated successfully' }
    } catch (error) {
      console.error('Error generating receipt:', error)
      return { success: false, message: 'Error generating receipt' }
    }
  }

  async printReceipt(printRequest: PrintRequest): Promise<{ success: boolean; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(printRequest.accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'receipt_management')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_RECEIPT_ACCESS',
          employeeId: printRequest.employeeId,
          details: 'Attempted to print receipt without permission',
          severity: 'high',
          ipAddress: printRequest.ipAddress
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      const receipt = this.receipts.get(printRequest.receiptId)
      const printer = this.printers.get(printRequest.printerId)

      if (!receipt) {
        return { success: false, message: 'Receipt not found' }
      }

      if (!printer || !printer.isActive) {
        return { success: false, message: 'Printer not available' }
      }

      // Generate receipt content
      const receiptContent = await this.generateReceiptContent(receipt, printer)
      
      // Send to printer (this would integrate with actual printer hardware)
      const printResult = await this.sendToPrinter(printer, receiptContent, printRequest.copies)
      
      if (printResult.success) {
        // Update receipt print count
        receipt.printCount += printRequest.copies
        receipt.lastPrintedAt = new Date().toISOString()
        this.receipts.set(printRequest.receiptId, receipt)
        await this.saveReceiptToFirestore(receipt)

        // Log action
        await antiTheftService.logAction({
          action: 'RECEIPT_PRINTED',
          employeeId: printRequest.employeeId,
          details: `Printed receipt ${receipt.receiptNumber} ${printRequest.copies} time(s)`,
          severity: 'low',
          ipAddress: printRequest.ipAddress
        })

        return { success: true, message: `Receipt printed successfully (${printRequest.copies} copies)` }
      } else {
        return { success: false, message: `Print failed: ${printResult.message}` }
      }
    } catch (error) {
      console.error('Error printing receipt:', error)
      return { success: false, message: 'Error printing receipt' }
    }
  }

  async reprintReceipt(receiptId: string, employeeId: string, accessCode: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'receipt_management')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_RECEIPT_ACCESS',
          employeeId,
          details: 'Attempted to reprint receipt without permission',
          severity: 'high',
          ipAddress: 'unknown'
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      const receipt = this.receipts.get(receiptId)
      if (!receipt) {
        return { success: false, message: 'Receipt not found' }
      }

      // Get default printer for receipt type
      const defaultPrinter = this.getDefaultPrinterForReceipt(receipt)
      if (!defaultPrinter) {
        return { success: false, message: 'No suitable printer available' }
      }

      // Print receipt
      const printRequest: PrintRequest = {
        receiptId,
        printerId: defaultPrinter.id,
        copies: 1,
        employeeId,
        accessCode,
        ipAddress: 'unknown'
      }

      const printResult = await this.printReceipt(printRequest)
      
      if (printResult.success) {
        // Log reprint action
        await antiTheftService.logAction({
          action: 'RECEIPT_REPRINTED',
          employeeId,
          details: `Reprinted receipt ${receipt.receiptNumber}. Reason: ${reason}`,
          severity: 'medium',
          ipAddress: 'unknown'
        })

        return { success: true, message: 'Receipt reprinted successfully' }
      } else {
        return printResult
      }
    } catch (error) {
      console.error('Error reprinting receipt:', error)
      return { success: false, message: 'Error reprinting receipt' }
    }
  }

  async voidReceipt(receiptId: string, reason: string, employeeId: string, accessCode: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate employee access
      const authResult = await authService.validateAccessCode(accessCode)
      if (!authResult.success || !authResult.employee) {
        return { success: false, message: 'Invalid access code' }
      }

      // Check permissions
      if (!authService.hasPermission(authResult.employee, 'receipt_void')) {
        await antiTheftService.logAction({
          action: 'UNAUTHORIZED_RECEIPT_ACCESS',
          employeeId,
          details: 'Attempted to void receipt without permission',
          severity: 'high',
          ipAddress: 'unknown'
        })
        return { success: false, message: 'Insufficient permissions' }
      }

      const receipt = this.receipts.get(receiptId)
      if (!receipt) {
        return { success: false, message: 'Receipt not found' }
      }

      if (receipt.isVoid) {
        return { success: false, message: 'Receipt is already void' }
      }

      // Void receipt
      receipt.isVoid = true
      receipt.voidReason = reason
      receipt.voidedBy = employeeId
      receipt.voidedAt = new Date().toISOString()
      receipt.updatedAt = new Date().toISOString()

      this.receipts.set(receiptId, receipt)

      // Log action
      await antiTheftService.logAction({
        action: 'RECEIPT_VOIDED',
        employeeId,
        details: `Voided receipt ${receipt.receiptNumber}. Reason: ${reason}`,
        severity: 'high',
        ipAddress: 'unknown'
      })

      // Save to Firestore
      await this.saveReceiptToFirestore(receipt)

      return { success: true, message: 'Receipt voided successfully' }
    } catch (error) {
      console.error('Error voiding receipt:', error)
      return { success: false, message: 'Error voiding receipt' }
    }
  }

  async getReceiptById(receiptId: string): Promise<Receipt | null> {
    return this.receipts.get(receiptId) || null
  }

  async getReceiptsByOrder(orderId: string): Promise<Receipt[]> {
    return Array.from(this.receipts.values()).filter(receipt => receipt.orderId === orderId)
  }

  async getReceiptsByDateRange(startDate: string, endDate: string): Promise<Receipt[]> {
    const start = new Date(startDate)
    const end = new Date(endDate)

    return Array.from(this.receipts.values()).filter(receipt => {
      const receiptDate = new Date(receipt.timestamp)
      return receiptDate >= start && receiptDate <= end
    })
  }

  async getReceiptTemplates(): Promise<ReceiptTemplate[]> {
    return Array.from(this.templates.values())
  }

  async getPrinters(): Promise<PrinterConfig[]> {
    return Array.from(this.printers.values())
  }

  private generateReceiptNumber(): string {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    
    return `R${year}${month}${day}${random}`
  }

  private async generateReceiptContent(receipt: Receipt, printer: PrinterConfig): Promise<string> {
    const template = this.templates.get(printer.defaultTemplate || 'template_58mm')
    if (!template) {
      throw new Error('Receipt template not found')
    }

    let content = ''

    // Header
    content += template.header + '\n'
    content += '='.repeat(printer.maxLineLength) + '\n'

    // Receipt info
    content += `Receipt: ${receipt.receiptNumber}\n`
    content += `Date: ${new Date(receipt.timestamp).toLocaleString()}\n`
    if (receipt.tableId) {
      content += `Table: ${receipt.tableId}\n`
    }
    if (receipt.customerName) {
      content += `Customer: ${receipt.customerName}\n`
    }
    content += '\n'

    // Items
    content += 'ITEMS:\n'
    content += '-'.repeat(printer.maxLineLength) + '\n'
    
    for (const item of receipt.items) {
      const itemLine = `${item.name} x${item.quantity}`
      const priceLine = `$${item.totalPrice.toFixed(2)}`
      
      // Truncate item name if too long
      const maxItemLength = printer.maxLineLength - priceLine.length - 1
      const truncatedItem = itemLine.length > maxItemLength 
        ? itemLine.substring(0, maxItemLength - 3) + '...'
        : itemLine
      
      content += `${truncatedItem.padEnd(maxItemLength)} ${priceLine}\n`
      
      if (item.modifiers && item.modifiers.length > 0) {
        content += `  ${item.modifiers.join(', ')}\n`
      }
      if (item.notes) {
        content += `  Note: ${item.notes}\n`
      }
    }

    content += '-'.repeat(printer.maxLineLength) + '\n'

    // Totals
    content += `Subtotal: ${' '.repeat(printer.maxLineLength - 10)}$${receipt.subtotal.toFixed(2)}\n`
    if (receipt.tax > 0) {
      content += `Tax: ${' '.repeat(printer.maxLineLength - 4)}$${receipt.tax.toFixed(2)}\n`
    }
    if (receipt.discounts > 0) {
      content += `Discounts: ${' '.repeat(printer.maxLineLength - 11)}-$${receipt.discounts.toFixed(2)}\n`
    }
    content += `TOTAL: ${' '.repeat(printer.maxLineLength - 7)}$${receipt.total.toFixed(2)}\n`

    content += '\n'
    content += `Payment: ${receipt.paymentMethod}\n`
    content += `Employee: ${receipt.employeeName}\n`

    // Footer
    content += '\n' + template.footer + '\n'

    // QR Code and Barcode placeholders
    if (template.includeQR) {
      content += '[QR Code]\n'
    }
    if (template.includeBarcode) {
      content += `[Barcode: ${receipt.receiptNumber}]\n`
    }

    return content
  }

  private async sendToPrinter(printer: PrinterConfig, content: string, copies: number): Promise<{ success: boolean; message: string }> {
    try {
      // This is a mock implementation
      // In a real system, this would integrate with printer drivers or network protocols
      
      console.log(`Sending to printer: ${printer.name}`)
      console.log(`Content length: ${content.length} characters`)
      console.log(`Copies: ${copies}`)
      console.log('Content:')
      console.log(content)

      // Simulate print delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      return { success: true, message: 'Print job sent successfully' }
    } catch (error) {
      console.error('Error sending to printer:', error)
      return { success: false, message: 'Failed to send to printer' }
    }
  }

  private getDefaultPrinterForReceipt(receipt: Receipt): PrinterConfig | null {
    // Find the most suitable printer based on receipt content and available printers
    const activePrinters = Array.from(this.printers.values()).filter(p => p.isActive)
    
    if (activePrinters.length === 0) return null
    
    // For now, return the first active printer
    // In a real system, you might have logic to choose based on receipt size, printer availability, etc.
    return activePrinters[0]
  }

  // Mock data methods (these would be replaced with actual service calls)
  private async getOrderData(orderId: string): Promise<any> {
    // Mock order data - replace with actual order service call
    return {
      id: orderId,
      items: [
        { name: 'Billiard Table Rental', price: 25.00, quantity: 2, modifiers: [], notes: '' },
        { name: 'Cue Rental', price: 5.00, quantity: 1, modifiers: [], notes: 'Premium cue' }
      ],
      subtotal: 55.00,
      tax: 5.50,
      discounts: 0,
      total: 60.50,
      currency: 'USD',
      customerId: 'customer_123',
      customerName: 'John Doe',
      tableId: 5
    }
  }

  private async getTransactionData(transactionId: string): Promise<any> {
    // Mock transaction data - replace with actual payment service call
    return {
      id: transactionId,
      paymentMethod: 'Credit Card',
      amount: 60.50,
      status: 'completed'
    }
  }

  // Firestore integration methods
  private async saveReceiptToFirestore(receipt: Receipt): Promise<void> {
    try {
      await this.db.collection(COLLECTIONS.RECEIPTS).doc(receipt.id).set(receipt)
    } catch (error) {
      console.error('Error saving receipt to Firestore:', error)
    }
  }

  private async saveTemplatesToFirestore(): Promise<void> {
    try {
      const batch = this.db.batch()
      for (const template of this.templates.values()) {
        const docRef = this.db.collection(COLLECTIONS.RECEIPT_TEMPLATES).doc(template.id)
        batch.set(docRef, template)
      }
      await batch.commit()
    } catch (error) {
      console.error('Error saving templates to Firestore:', error)
    }
  }

  private async savePrintersToFirestore(): Promise<void> {
    try {
      const batch = this.db.batch()
      for (const printer of this.printers.values()) {
        const docRef = this.db.collection(COLLECTIONS.PRINTERS).doc(printer.id)
        batch.set(docRef, printer)
      }
      await batch.commit()
    } catch (error) {
      console.error('Error saving printers to Firestore:', error)
    }
  }
}

export const receiptService = ReceiptService.getInstance()
