import { AuthService } from './auth.service';
import { AntiTheftService } from './antiTheftService';
import { Transaction, Order, Employee, Customer } from '../models';

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'cash' | 'card' | 'mobile' | 'voucher' | 'loyalty_points';
  enabled: boolean;
  requiresApproval: boolean;
  maxAmount?: number;
  processingFee?: number;
  processingFeeType: 'percentage' | 'fixed';
}

export interface PaymentRequest {
  orderId: string;
  amount: number;
  method: string;
  customerId?: string;
  employeeId: string;
  splitPayments?: Array<{
    method: string;
    amount: number;
    reference?: string;
  }>;
  tip?: number;
  tipPercentage?: number;
  notes?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amount: number;
  method: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  reference: string;
  timestamp: string;
  errorMessage?: string;
  requiresApproval?: boolean;
  approvalCode?: string;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  reason: string;
  employeeId: string;
  managerApproval?: boolean;
  managerId?: string;
  notes?: string;
}

export interface PaymentAnalytics {
  totalTransactions: number;
  totalRevenue: number;
  averageTransactionValue: number;
  paymentMethodDistribution: Record<string, { count: number; amount: number }>;
  hourlyRevenue: Array<{ hour: number; revenue: number; transactions: number }>;
  topCustomers: Array<{ customerId: string; name: string; totalSpent: number; visits: number }>;
  refundRate: number;
  tipAnalytics: {
    totalTips: number;
    averageTipPercentage: number;
    tipDistribution: Record<string, number>;
  };
}

export class PaymentService {
  private static instance: PaymentService;
  private authService: AuthService;
  private antiTheftService: AntiTheftService;

  private paymentMethods: PaymentMethod[] = [
    {
      id: 'cash',
      name: 'Cash',
      type: 'cash',
      enabled: true,
      requiresApproval: false,
      maxAmount: 1000,
      processingFee: 0,
      processingFeeType: 'fixed'
    },
    {
      id: 'credit_card',
      name: 'Credit Card',
      type: 'card',
      enabled: true,
      requiresApproval: false,
      maxAmount: 5000,
      processingFee: 2.5,
      processingFeeType: 'percentage'
    },
    {
      id: 'debit_card',
      name: 'Debit Card',
      type: 'card',
      enabled: true,
      requiresApproval: false,
      maxAmount: 2000,
      processingFee: 1.5,
      processingFeeType: 'percentage'
    },
    {
      id: 'mobile_payment',
      name: 'Mobile Payment',
      type: 'mobile',
      enabled: true,
      requiresApproval: false,
      maxAmount: 1000,
      processingFee: 1.0,
      processingFeeType: 'percentage'
    },
    {
      id: 'loyalty_points',
      name: 'Loyalty Points',
      type: 'loyalty_points',
      enabled: true,
      requiresApproval: true,
      maxAmount: 500,
      processingFee: 0,
      processingFeeType: 'fixed'
    }
  ];

  private constructor() {
    this.authService = AuthService.getInstance();
    this.antiTheftService = AntiTheftService.getInstance();
  }

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Process payment for an order
   */
  async processPayment(
    paymentRequest: PaymentRequest
  ): Promise<PaymentResult> {
    const { orderId, amount, method, employeeId, splitPayments, tip, tipPercentage } = paymentRequest;

    // Validate payment method
    const paymentMethod = this.paymentMethods.find(pm => pm.id === method);
    if (!paymentMethod || !paymentMethod.enabled) {
      throw new Error('Invalid or disabled payment method');
    }

    // Check amount limits
    if (paymentMethod.maxAmount && amount > paymentMethod.maxAmount) {
      throw new Error(`Amount exceeds maximum limit for ${paymentMethod.name}`);
    }

    // Calculate tip if percentage is provided
    let finalTip = tip || 0;
    if (tipPercentage && !tip) {
      finalTip = Math.round(amount * (tipPercentage / 100) * 100) / 100;
    }

    const totalAmount = amount + finalTip;

    // Check if approval is required
    if (paymentMethod.requiresApproval) {
      return {
        success: true,
        transactionId: `pending_${Date.now()}`,
        amount: totalAmount,
        method,
        status: 'pending',
        reference: `Order #${orderId}`,
        timestamp: new Date().toISOString(),
        requiresApproval: true
      };
    }

    // Process payment based on method
    let paymentResult: PaymentResult;
    switch (method) {
      case 'cash':
        paymentResult = await this.processCashPayment(paymentRequest, totalAmount);
        break;
      case 'credit_card':
      case 'debit_card':
        paymentResult = await this.processCardPayment(paymentRequest, totalAmount);
        break;
      case 'mobile_payment':
        paymentResult = await this.processMobilePayment(paymentRequest, totalAmount);
        break;
      case 'loyalty_points':
        paymentResult = await this.processLoyaltyPayment(paymentRequest, totalAmount);
        break;
      default:
        throw new Error(`Unsupported payment method: ${method}`);
    }

    // Log payment processing
    await this.antiTheftService.logAction(
      employeeId,
      'payment_processed',
      { 
        orderId, 
        amount: totalAmount, 
        method, 
        transactionId: paymentResult.transactionId,
        tip: finalTip
      }
    );

    return paymentResult;
  }

  /**
   * Process cash payment
   */
  private async processCashPayment(
    paymentRequest: PaymentRequest,
    totalAmount: number
  ): Promise<PaymentResult> {
    const transactionId = `cash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      transactionId,
      amount: totalAmount,
      method: 'cash',
      status: 'completed',
      reference: `Order #${paymentRequest.orderId}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process card payment
   */
  private async processCardPayment(
    paymentRequest: PaymentRequest,
    totalAmount: number
  ): Promise<PaymentResult> {
    const transactionId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate card processing
    const processingFee = this.calculateProcessingFee(totalAmount, 'card');
    const finalAmount = totalAmount + processingFee;

    // Mock successful card payment
    return {
      success: true,
      transactionId,
      amount: finalAmount,
      method: 'card',
      status: 'completed',
      reference: `Order #${paymentRequest.orderId}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process mobile payment
   */
  private async processMobilePayment(
    paymentRequest: PaymentRequest,
    totalAmount: number
  ): Promise<PaymentResult> {
    const transactionId = `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate mobile payment processing
    const processingFee = this.calculateProcessingFee(totalAmount, 'mobile');
    const finalAmount = totalAmount + processingFee;

    return {
      success: true,
      transactionId,
      amount: finalAmount,
      method: 'mobile',
      status: 'completed',
      reference: `Order #${paymentRequest.orderId}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process loyalty points payment
   */
  private async processLoyaltyPayment(
    paymentRequest: PaymentRequest,
    totalAmount: number
  ): Promise<PaymentResult> {
    const transactionId = `loyalty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // This would integrate with the loyalty service
    // For now, return pending status requiring approval
    return {
      success: true,
      transactionId,
      amount: totalAmount,
      method: 'loyalty_points',
      status: 'pending',
      reference: `Order #${paymentRequest.orderId}`,
      timestamp: new Date().toISOString(),
      requiresApproval: true
    };
  }

  /**
   * Calculate processing fee
   */
  private calculateProcessingFee(amount: number, method: string): number {
    const paymentMethod = this.paymentMethods.find(pm => pm.id === method);
    if (!paymentMethod || !paymentMethod.processingFee) return 0;

    if (paymentMethod.processingFeeType === 'percentage') {
      return Math.round(amount * (paymentMethod.processingFee / 100) * 100) / 100;
    } else {
      return paymentMethod.processingFee;
    }
  }

  /**
   * Process split payment
   */
  async processSplitPayment(
    orderId: string,
    splitPayments: Array<{
      method: string;
      amount: number;
      reference?: string;
    }>,
    employeeId: string
  ): Promise<PaymentResult[]> {
    const results: PaymentResult[] = [];

    for (const split of splitPayments) {
      const paymentRequest: PaymentRequest = {
        orderId,
        amount: split.amount,
        method: split.method,
        employeeId,
        reference: split.reference
      };

      try {
        const result = await this.processPayment(paymentRequest);
        results.push(result);
      } catch (error) {
        // Log failed split payment
        await this.antiTheftService.logAction(
          employeeId,
          'split_payment_failed',
          { orderId, method: split.method, amount: split.amount, error: error.message }
        );
        throw error;
      }
    }

    // Log successful split payment
    await this.antiTheftService.logAction(
      employeeId,
      'split_payment_processed',
      { orderId, splits: splitPayments.length, totalAmount: splitPayments.reduce((sum, s) => sum + s.amount, 0) }
    );

    return results;
  }

  /**
   * Process refund
   */
  async processRefund(
    refundRequest: RefundRequest
  ): Promise<PaymentResult> {
    const { transactionId, amount, reason, employeeId, managerApproval, managerId } = refundRequest;

    // Check if manager approval is required
    if (amount > 100 && !managerApproval) {
      throw new Error('Manager approval required for refunds over $100');
    }

    // Validate original transaction
    const originalTransaction = await this.getTransaction(transactionId);
    if (!originalTransaction) {
      throw new Error('Original transaction not found');
    }

    if (amount > originalTransaction.amount) {
      throw new Error('Refund amount cannot exceed original transaction amount');
    }

    // Create refund transaction
    const refundTransactionId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const refundResult: PaymentResult = {
      success: true,
      transactionId: refundTransactionId,
      amount: -amount, // Negative amount for refunds
      method: `refund_${originalTransaction.method}`,
      status: 'refunded',
      reference: `Refund for ${originalTransaction.reference}`,
      timestamp: new Date().toISOString()
    };

    // Log refund
    await this.antiTheftService.logAction(
      employeeId,
      'refund_processed',
      { 
        originalTransactionId: transactionId, 
        refundAmount: amount, 
        reason, 
        managerApproval,
        managerId 
      }
    );

    return refundResult;
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<Transaction | null> {
    // Mock implementation - replace with Firestore query
    const mockTransaction: Transaction = {
      id: transactionId,
      orderId: 'order_123',
      amount: 45.99,
      method: 'credit_card',
      status: 'completed',
      timestamp: new Date().toISOString(),
      employeeId: 'employee_123',
      customerId: 'customer_123',
      reference: 'Order #123',
      processingFee: 1.15,
      tip: 5.00,
      notes: 'Sample transaction'
    };

    return mockTransaction;
  }

  /**
   * Get payment methods
   */
  getPaymentMethods(): PaymentMethod[] {
    return this.paymentMethods.filter(pm => pm.enabled);
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(
    methodId: string,
    updates: Partial<PaymentMethod>,
    employeeId: string
  ): Promise<void> {
    const method = this.paymentMethods.find(pm => pm.id === methodId);
    if (!method) {
      throw new Error('Payment method not found');
    }

    // Log changes
    const changes = Object.keys(updates).filter(key => 
      method[key as keyof PaymentMethod] !== updates[key as keyof PaymentMethod]
    );

    if (changes.length > 0) {
      await this.antiTheftService.logAction(
        employeeId,
        'payment_method_updated',
        { methodId, methodName: method.name, changes }
      );
    }

    // Apply updates
    Object.assign(method, updates);
  }

  /**
   * Get payment analytics
   */
  async getPaymentAnalytics(
    startDate: string,
    endDate: string
  ): Promise<PaymentAnalytics> {
    // Mock implementation - replace with actual analytics calculation
    const totalTransactions = 150;
    const totalRevenue = 4500.00;
    const averageTransactionValue = totalRevenue / totalTransactions;

    const paymentMethodDistribution: Record<string, { count: number; amount: number }> = {
      'cash': { count: 45, amount: 1350.00 },
      'credit_card': { count: 60, amount: 1800.00 },
      'debit_card': { count: 30, amount: 900.00 },
      'mobile_payment': { count: 15, amount: 450.00 }
    };

    const hourlyRevenue = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      revenue: Math.floor(Math.random() * 200) + 50,
      transactions: Math.floor(Math.random() * 10) + 2
    }));

    const topCustomers = [
      { customerId: 'customer_1', name: 'John Doe', totalSpent: 450.00, visits: 15 },
      { customerId: 'customer_2', name: 'Jane Smith', totalSpent: 380.00, visits: 12 },
      { customerId: 'customer_3', name: 'Bob Johnson', totalSpent: 320.00, visits: 10 }
    ];

    const refundRate = 0.05; // 5%

    const tipAnalytics = {
      totalTips: 450.00,
      averageTipPercentage: 15.5,
      tipDistribution: {
        '0%': 10,
        '10%': 25,
        '15%': 40,
        '20%': 20,
        '25%': 5
      }
    };

    return {
      totalTransactions,
      totalRevenue,
      averageTransactionValue,
      paymentMethodDistribution,
      hourlyRevenue,
      topCustomers,
      refundRate,
      tipAnalytics
    };
  }

  /**
   * Get daily cash reconciliation
   */
  async getDailyCashReconciliation(
    date: string,
    employeeId: string
  ): Promise<{
    expectedCash: number;
    actualCash: number;
    difference: number;
    transactions: Transaction[];
    notes: string;
  }> {
    // Mock implementation - replace with actual reconciliation
    const expectedCash = 1350.00;
    const actualCash = 1348.50;
    const difference = actualCash - expectedCash;

    const transactions: Transaction[] = [
      {
        id: 'transaction_1',
        orderId: 'order_123',
        amount: 45.99,
        method: 'cash',
        status: 'completed',
        timestamp: date,
        employeeId,
        customerId: 'customer_123',
        reference: 'Order #123',
        processingFee: 0,
        tip: 5.00,
        notes: 'Cash payment'
      }
    ];

    return {
      expectedCash,
      actualCash,
      difference,
      transactions,
      notes: difference !== 0 ? `Variance of $${Math.abs(difference).toFixed(2)}` : 'Balanced'
    };
  }

  /**
   * Void transaction
   */
  async voidTransaction(
    transactionId: string,
    employeeId: string,
    reason: string
  ): Promise<void> {
    const transaction = await this.getTransaction(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'completed') {
      throw new Error('Only completed transactions can be voided');
    }

    // Log void action
    await this.antiTheftService.logAction(
      employeeId,
      'transaction_voided',
      { transactionId, amount: transaction.amount, reason }
    );

    // Update transaction status
    // await this.updateTransactionStatus(transactionId, 'voided');
  }
}
