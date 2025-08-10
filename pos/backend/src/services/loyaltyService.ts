import { AuthService } from './auth.service';
import { AntiTheftService } from './antiTheftService';
import { Customer, LoyaltyProgram, Transaction, Order, Alert } from '../models';

export interface LoyaltyTier {
  id: string;
  name: string;
  minPoints: number;
  discountPercentage: number;
  benefits: string[];
  color: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  discountAmount?: number;
  discountPercentage?: number;
  freeItem?: string;
  validFrom: string;
  validUntil: string;
  maxRedemptions: number;
  currentRedemptions: number;
  active: boolean;
}

export interface PointsTransaction {
  id: string;
  customerId: string;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus' | 'adjustment';
  points: number;
  orderId?: string;
  description: string;
  timestamp: string;
  employeeId?: string;
  reason?: string;
}

export interface CustomerRetentionMetrics {
  customerId: string;
  totalVisits: number;
  averageOrderValue: number;
  lastVisit: string;
  daysSinceLastVisit: number;
  totalSpent: number;
  loyaltyTier: string;
  churnRisk: 'low' | 'medium' | 'high';
  nextVisitPrediction: string;
}

export class LoyaltyService {
  private static instance: LoyaltyService;
  private authService: AuthService;
  private antiTheftService: AntiTheftService;

  private loyaltyTiers: LoyaltyTier[] = [
    {
      id: 'bronze',
      name: 'Bronze',
      minPoints: 0,
      discountPercentage: 0,
      benefits: ['Basic member benefits'],
      color: '#CD7F32'
    },
    {
      id: 'silver',
      name: 'Silver',
      minPoints: 1000,
      discountPercentage: 5,
      benefits: ['5% discount on food & drinks', 'Priority table reservation'],
      color: '#C0C0C0'
    },
    {
      id: 'gold',
      name: 'Gold',
      minPoints: 5000,
      discountPercentage: 10,
      benefits: ['10% discount on food & drinks', 'Priority table reservation', 'Free billiard hour monthly'],
      color: '#FFD700'
    },
    {
      id: 'platinum',
      name: 'Platinum',
      discountPercentage: 15,
      benefits: ['15% discount on food & drinks', 'Priority table reservation', 'Free billiard hour monthly', 'Exclusive events access'],
      color: '#E5E4E2',
      minPoints: 15000
    }
  ];

  private rewards: Reward[] = [
    {
      id: 'free_billiard_hour',
      name: 'Free Billiard Hour',
      description: 'One free hour of billiard table time',
      pointsCost: 500,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      maxRedemptions: 1000,
      currentRedemptions: 0,
      active: true
    },
    {
      id: 'food_discount_20',
      name: '20% Food Discount',
      description: '20% off on food items',
      pointsCost: 300,
      discountPercentage: 20,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      maxRedemptions: 500,
      currentRedemptions: 0,
      active: true
    },
    {
      id: 'drink_combo',
      name: 'Drink Combo',
      description: 'Buy 2 drinks, get 1 free',
      pointsCost: 200,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      maxRedemptions: 2000,
      currentRedemptions: 0,
      active: true
    }
  ];

  private constructor() {
    this.authService = AuthService.getInstance();
    this.antiTheftService = AntiTheftService.getInstance();
  }

  public static getInstance(): LoyaltyService {
    if (!LoyaltyService.instance) {
      LoyaltyService.instance = new LoyaltyService();
    }
    return LoyaltyService.instance;
  }

  /**
   * Create or update customer loyalty account
   */
  async createLoyaltyAccount(
    customerData: {
      name: string;
      email: string;
      phone: string;
      birthDate?: string;
      preferences?: string[];
    }
  ): Promise<LoyaltyProgram> {
    const customerId = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const loyaltyAccount: LoyaltyProgram = {
      id: customerId,
      customerId,
      customerName: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
      birthDate: customerData.birthDate,
      preferences: customerData.preferences || [],
      points: 0,
      tier: 'bronze',
      joinDate: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      totalSpent: 0,
      totalVisits: 0,
      active: true,
      specialOffers: [],
      notes: ''
    };

    // Log account creation
    await this.antiTheftService.logAction(
      'system',
      'loyalty_account_created',
      { customerId, customerName: customerData.name }
    );

    return loyaltyAccount;
  }

  /**
   * Earn points for a purchase
   */
  async earnPoints(
    customerId: string,
    orderId: string,
    orderAmount: number,
    employeeId: string
  ): Promise<PointsTransaction> {
    const pointsEarned = Math.floor(orderAmount * 0.1); // 10% of order value
    
    const pointsTransaction: PointsTransaction = {
      id: `points_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId,
      type: 'earned',
      points: pointsEarned,
      orderId,
      description: `Points earned from order #${orderId}`,
      timestamp: new Date().toISOString(),
      employeeId
    };

    // Update customer points
    // await this.updateCustomerPoints(customerId, pointsEarned);

    // Log points earning
    await this.antiTheftService.logAction(
      employeeId,
      'points_earned',
      { customerId, points: pointsEarned, orderId }
    );

    return pointsTransaction;
  }

  /**
   * Redeem points for rewards
   */
  async redeemPoints(
    customerId: string,
    rewardId: string,
    employeeId: string
  ): Promise<{
    success: boolean;
    reward: Reward;
    pointsTransaction: PointsTransaction;
    appliedDiscount?: number;
  }> {
    const reward = this.rewards.find(r => r.id === rewardId && r.active);
    if (!reward) {
      throw new Error('Reward not found or inactive');
    }

    // Check if customer has enough points
    const customer = await this.getCustomer(customerId);
    if (!customer || customer.points < reward.pointsCost) {
      throw new Error('Insufficient points');
    }

    // Check if reward is still available
    if (reward.currentRedemptions >= reward.maxRedemptions) {
      throw new Error('Reward limit reached');
    }

    // Check if reward is still valid
    const now = new Date();
    if (now < new Date(reward.validFrom) || now > new Date(reward.validUntil)) {
      throw new Error('Reward not valid');
    }

    // Create points transaction
    const pointsTransaction: PointsTransaction = {
      id: `points_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId,
      type: 'redeemed',
      points: -reward.pointsCost,
      description: `Redeemed ${reward.name}`,
      timestamp: new Date().toISOString(),
      employeeId
    };

    // Update reward redemption count
    reward.currentRedemptions++;

    // Calculate applied discount
    let appliedDiscount = 0;
    if (reward.discountAmount) {
      appliedDiscount = reward.discountAmount;
    } else if (reward.discountPercentage) {
      // This would be applied to the order total
      appliedDiscount = 0; // Will be calculated when applied to order
    }

    // Log redemption
    await this.antiTheftService.logAction(
      employeeId,
      'points_redeemed',
      { customerId, rewardId, rewardName: reward.name, pointsCost: reward.pointsCost }
    );

    return {
      success: true,
      reward,
      pointsTransaction,
      appliedDiscount
    };
  }

  /**
   * Get customer loyalty information
   */
  async getCustomer(customerId: string): Promise<LoyaltyProgram | null> {
    // Mock implementation - replace with Firestore query
    const mockCustomer: LoyaltyProgram = {
      id: customerId,
      customerId,
      customerName: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      points: 1250,
      tier: 'silver',
      joinDate: '2024-01-01T00:00:00.000Z',
      lastActivity: new Date().toISOString(),
      totalSpent: 1250,
      totalVisits: 15,
      active: true,
      specialOffers: [],
      notes: ''
    };

    return mockCustomer;
  }

  /**
   * Get customer retention metrics
   */
  async getCustomerRetentionMetrics(customerId: string): Promise<CustomerRetentionMetrics> {
    const customer = await this.getCustomer(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const lastVisit = new Date(customer.lastActivity);
    const now = new Date();
    const daysSinceLastVisit = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate churn risk
    let churnRisk: 'low' | 'medium' | 'high' = 'low';
    if (daysSinceLastVisit > 30) churnRisk = 'high';
    else if (daysSinceLastVisit > 14) churnRisk = 'medium';

    // Predict next visit (simple algorithm)
    const averageDaysBetweenVisits = customer.totalVisits > 1 ? 
      Math.floor(365 / customer.totalVisits) : 7;
    const nextVisitPrediction = new Date(now.getTime() + averageDaysBetweenVisits * 24 * 60 * 60 * 1000);

    return {
      customerId,
      totalVisits: customer.totalVisits,
      averageOrderValue: customer.totalSpent / customer.totalVisits,
      lastVisit: customer.lastActivity,
      daysSinceLastVisit,
      totalSpent: customer.totalSpent,
      loyaltyTier: customer.tier,
      churnRisk,
      nextVisitPrediction: nextVisitPrediction.toISOString()
    };
  }

  /**
   * Get available rewards for customer
   */
  async getAvailableRewards(customerId: string): Promise<Reward[]> {
    const customer = await this.getCustomer(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const now = new Date();
    return this.rewards.filter(reward => 
      reward.active &&
      reward.currentRedemptions < reward.maxRedemptions &&
      now >= new Date(reward.validFrom) &&
      now <= new Date(reward.validUntil) &&
      customer.points >= reward.pointsCost
    );
  }

  /**
   * Get loyalty tiers
   */
  getLoyaltyTiers(): LoyaltyTier[] {
    return [...this.loyaltyTiers];
  }

  /**
   * Calculate tier for customer based on points
   */
  calculateTier(points: number): string {
    for (let i = this.loyaltyTiers.length - 1; i >= 0; i--) {
      if (points >= this.loyaltyTiers[i].minPoints) {
        return this.loyaltyTiers[i].id;
      }
    }
    return 'bronze';
  }

  /**
   * Get tier benefits
   */
  getTierBenefits(tierId: string): LoyaltyTier | null {
    return this.loyaltyTiers.find(tier => tier.id === tierId) || null;
  }

  /**
   * Update customer activity
   */
  async updateCustomerActivity(
    customerId: string,
    orderAmount: number,
    employeeId: string
  ): Promise<void> {
    const customer = await this.getCustomer(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Update customer stats
    const updatedCustomer = {
      ...customer,
      lastActivity: new Date().toISOString(),
      totalSpent: customer.totalSpent + orderAmount,
      totalVisits: customer.totalVisits + 1
    };

    // Calculate new tier
    const newTier = this.calculateTier(updatedCustomer.points);
    if (newTier !== customer.tier) {
      updatedCustomer.tier = newTier;
      
      // Log tier upgrade
      await this.antiTheftService.logAction(
        employeeId,
        'loyalty_tier_upgraded',
        { customerId, oldTier: customer.tier, newTier, points: updatedCustomer.points }
      );
    }

    // Save updated customer
    // await this.saveCustomer(updatedCustomer);
  }

  /**
   * Get customer points history
   */
  async getPointsHistory(
    customerId: string,
    startDate?: string,
    endDate?: string
  ): Promise<PointsTransaction[]> {
    // Mock implementation - replace with Firestore query
    const mockTransactions: PointsTransaction[] = [
      {
        id: 'points_1',
        customerId,
        type: 'earned',
        points: 50,
        orderId: 'order_123',
        description: 'Points earned from order #order_123',
        timestamp: new Date().toISOString(),
        employeeId: 'employee_123'
      },
      {
        id: 'points_2',
        customerId,
        type: 'redeemed',
        points: -100,
        description: 'Redeemed Free Billiard Hour',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        employeeId: 'employee_123'
      }
    ];

    return mockTransactions.filter(transaction => {
      if (startDate && transaction.timestamp < startDate) return false;
      if (endDate && transaction.timestamp > endDate) return false;
      return true;
    });
  }

  /**
   * Create special offer for customer
   */
  async createSpecialOffer(
    customerId: string,
    offer: {
      name: string;
      description: string;
      discountPercentage: number;
      validUntil: string;
      conditions?: string[];
    },
    employeeId: string
  ): Promise<void> {
    const customer = await this.getCustomer(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const specialOffer = {
      id: `offer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...offer,
      createdAt: new Date().toISOString(),
      createdBy: employeeId,
      active: true
    };

    // Add offer to customer
    customer.specialOffers.push(specialOffer);

    // Log special offer creation
    await this.antiTheftService.logAction(
      employeeId,
      'special_offer_created',
      { customerId, offerName: offer.name, discountPercentage: offer.discountPercentage }
    );

    // Save updated customer
    // await this.saveCustomer(customer);
  }

  /**
   * Get loyalty analytics
   */
  async getLoyaltyAnalytics(
    startDate: string,
    endDate: string
  ): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    averagePointsPerCustomer: number;
    totalPointsEarned: number;
    totalPointsRedeemed: number;
    tierDistribution: Record<string, number>;
    topCustomers: Array<{ customerId: string; name: string; points: number; tier: string }>;
    churnRate: number;
  }> {
    // Mock implementation - replace with actual analytics calculation
    return {
      totalCustomers: 150,
      activeCustomers: 120,
      averagePointsPerCustomer: 850,
      totalPointsEarned: 127500,
      totalPointsRedeemed: 45000,
      tierDistribution: {
        bronze: 45,
        silver: 60,
        gold: 35,
        platinum: 10
      },
      topCustomers: [
        { customerId: 'customer_1', name: 'John Doe', points: 2500, tier: 'gold' },
        { customerId: 'customer_2', name: 'Jane Smith', points: 1800, tier: 'silver' },
        { customerId: 'customer_3', name: 'Bob Johnson', points: 3200, tier: 'platinum' }
      ],
      churnRate: 0.15
    };
  }
}
