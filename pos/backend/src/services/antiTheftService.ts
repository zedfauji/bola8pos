import { AuthService } from './auth.service';
import { Employee, AuditLog, Alert, TableMigration, CashReconciliation, AnomalyDetectionResult } from '../models';

export interface CCTVIntegration {
  timestamp: string;
  cameraId: string;
  action: string;
  employeeId: string;
  tableId?: string;
  orderId?: string;
  videoUrl?: string;
}

export interface ManipulationAttempt {
  type: 'void' | 'discount' | 'refund' | 'cash_drawer' | 'inventory' | 'access_code';
  employeeId: string;
  timestamp: string;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  managerApproval?: {
    managerId: string;
    timestamp: string;
    approved: boolean;
    reason?: string;
  };
}

export interface AntiTheftConfig {
  maxVoidsPerShift: number;
  maxDiscountPercentage: number;
  maxCashDrawerDiscrepancy: number;
  suspiciousActivityThreshold: number;
  requireManagerApproval: boolean;
  enableCCTVIntegration: boolean;
  enableAnomalyDetection: boolean;
}

export class AntiTheftService {
  private static instance: AntiTheftService;
  private authService: AuthService;
  private config: AntiTheftConfig;

  private constructor() {
    this.authService = AuthService.getInstance();
    this.config = {
      maxVoidsPerShift: 3,
      maxDiscountPercentage: 20,
      maxCashDrawerDiscrepancy: 50,
      suspiciousActivityThreshold: 5,
      requireManagerApproval: true,
      enableCCTVIntegration: true,
      enableAnomalyDetection: true
    };
  }

  public static getInstance(): AntiTheftService {
    if (!AntiTheftService.instance) {
      AntiTheftService.instance = new AntiTheftService();
    }
    return AntiTheftService.instance;
  }

  /**
   * Log all actions for audit purposes
   */
  async logAction(
    employeeId: string,
    action: string,
    details: any,
    tableId?: string,
    orderId?: string,
    ipAddress?: string
  ): Promise<AuditLog> {
    const timestamp = new Date().toISOString();
    const employee = await this.authService.getCachedEmployee(employeeId);
    
    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      employeeId,
      employeeName: employee?.name || 'Unknown',
      action,
      details: JSON.stringify(details),
      tableId,
      orderId,
      ipAddress,
      cctvTimestamp: this.config.enableCCTVIntegration ? timestamp : undefined
    };

    // Save to Firestore
    // await this.saveAuditLog(auditLog);

    // Create CCTV integration if enabled
    if (this.config.enableCCTVIntegration) {
      await this.createCCTVIntegration(auditLog);
    }

    return auditLog;
  }

  /**
   * Create CCTV integration record
   */
  private async createCCTVIntegration(auditLog: AuditLog): Promise<CCTVIntegration> {
    const cctvRecord: CCTVIntegration = {
      timestamp: auditLog.timestamp,
      cameraId: this.determineCameraId(auditLog.tableId),
      action: auditLog.action,
      employeeId: auditLog.employeeId,
      tableId: auditLog.tableId,
      orderId: auditLog.orderId,
      videoUrl: this.generateVideoUrl(auditLog.timestamp, auditLog.tableId)
    };

    // Save CCTV record
    // await this.saveCCTVRecord(cctvRecord);

    return cctvRecord;
  }

  /**
   * Determine camera ID based on table location
   */
  private determineCameraId(tableId?: string): string {
    if (!tableId) return 'main_entrance';
    
    if (tableId.startsWith('Billiard')) return 'billiard_area';
    if (tableId.startsWith('Normal')) return 'dining_area';
    if (tableId.startsWith('LaBarra')) return 'bar_area';
    
    return 'general_area';
  }

  /**
   * Generate video URL for CCTV timestamp
   */
  private generateVideoUrl(timestamp: string, tableId?: string): string {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0];
    
    return `/cctv/${dateStr}/${timeStr}/${tableId || 'general'}.mp4`;
  }

  /**
   * Check for manipulation attempts
   */
  async checkManipulationAttempt(
    type: ManipulationAttempt['type'],
    employeeId: string,
    details: any
  ): Promise<ManipulationAttempt> {
    const timestamp = new Date().toISOString();
    const employee = await this.authService.getCachedEmployee(employeeId);
    
    const attempt: ManipulationAttempt = {
      type,
      employeeId,
      timestamp,
      details: JSON.stringify(details),
      severity: this.calculateSeverity(type, details),
      requiresApproval: this.requiresManagerApproval(type, details)
    };

    // Log the attempt
    await this.logAction(employeeId, `manipulation_attempt_${type}`, details);

    // Create alert if severity is high
    if (attempt.severity === 'high' || attempt.severity === 'critical') {
      await this.createAlert(attempt);
    }

    return attempt;
  }

  /**
   * Calculate severity of manipulation attempt
   */
  private calculateSeverity(type: string, details: any): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'void':
        const voidAmount = details.amount || 0;
        if (voidAmount > 100) return 'critical';
        if (voidAmount > 50) return 'high';
        if (voidAmount > 20) return 'medium';
        return 'low';
      
      case 'discount':
        const discountPercent = details.percentage || 0;
        if (discountPercent > 30) return 'critical';
        if (discountPercent > 20) return 'high';
        if (discountPercent > 10) return 'medium';
        return 'low';
      
      case 'cash_drawer':
        const discrepancy = Math.abs(details.discrepancy || 0);
        if (discrepancy > 100) return 'critical';
        if (discrepancy > 50) return 'high';
        if (discrepancy > 20) return 'medium';
        return 'low';
      
      case 'access_code':
        return 'high'; // Failed access attempts are always high severity
      
      default:
        return 'medium';
    }
  }

  /**
   * Determine if manager approval is required
   */
  private requiresManagerApproval(type: string, details: any): boolean {
    if (!this.config.requireManagerApproval) return false;
    
    switch (type) {
      case 'void':
        return (details.amount || 0) > 20;
      case 'discount':
        return (details.percentage || 0) > 10;
      case 'refund':
        return true;
      case 'cash_drawer':
        return Math.abs(details.discrepancy || 0) > 20;
      default:
        return false;
    }
  }

  /**
   * Create alert for suspicious activity
   */
  private async createAlert(attempt: ManipulationAttempt): Promise<Alert> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'manipulation_attempt',
      severity: attempt.severity,
      message: `Suspicious ${attempt.type} attempt detected`,
      details: attempt.details,
      employeeId: attempt.employeeId,
      requiresAction: attempt.requiresApproval,
      status: 'active'
    };

    // Save alert
    // await this.saveAlert(alert);

    return alert;
  }

  /**
   * Process manager approval
   */
  async processManagerApproval(
    attemptId: string,
    managerId: string,
    approved: boolean,
    reason?: string
  ): Promise<ManipulationAttempt> {
    // Get the manipulation attempt
    // const attempt = await this.getManipulationAttempt(attemptId);
    
    // For now, create a mock attempt
    const attempt: ManipulationAttempt = {
      type: 'void',
      employeeId: 'employee_123',
      timestamp: new Date().toISOString(),
      details: 'Mock attempt',
      severity: 'medium',
      requiresApproval: true
    };

    attempt.managerApproval = {
      managerId,
      timestamp: new Date().toISOString(),
      approved,
      reason
    };

    // Log the approval decision
    await this.logAction(
      managerId,
      `manager_approval_${approved ? 'granted' : 'denied'}`,
      { attemptId, reason }
    );

    return attempt;
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(
    filters: {
      startDate?: string;
      endDate?: string;
      employeeId?: string;
      actionType?: string;
      tableId?: string;
      orderId?: string;
    }
  ): Promise<AuditLog[]> {
    // Mock implementation - replace with Firestore query
    const mockLogs: AuditLog[] = [
      {
        id: 'audit_1',
        timestamp: new Date().toISOString(),
        employeeId: 'employee_123',
        employeeName: 'John Doe',
        action: 'table_assignment',
        details: 'Table Billiard 1 assigned to customer',
        tableId: 'Billiard 1',
        ipAddress: '192.168.1.100'
      }
    ];

    return mockLogs.filter(log => {
      if (filters.startDate && log.timestamp < filters.startDate) return false;
      if (filters.endDate && log.timestamp > filters.endDate) return false;
      if (filters.employeeId && log.employeeId !== filters.employeeId) return false;
      if (filters.actionType && !log.action.includes(filters.actionType)) return false;
      if (filters.tableId && log.tableId !== filters.tableId) return false;
      if (filters.orderId && log.orderId !== filters.orderId) return false;
      return true;
    });
  }

  /**
   * Get manipulation attempts summary
   */
  async getManipulationSummary(
    startDate: string,
    endDate: string
  ): Promise<{
    totalAttempts: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    requiresApproval: number;
    approved: number;
    denied: number;
  }> {
    // Mock implementation - replace with actual data aggregation
    return {
      totalAttempts: 15,
      byType: {
        void: 8,
        discount: 4,
        cash_drawer: 2,
        access_code: 1
      },
      bySeverity: {
        low: 5,
        medium: 7,
        high: 2,
        critical: 1
      },
      requiresApproval: 8,
      approved: 6,
      denied: 2
    };
  }

  /**
   * Update anti-theft configuration
   */
  async updateConfig(newConfig: Partial<AntiTheftConfig>): Promise<AntiTheftConfig> {
    this.config = { ...this.config, ...newConfig };
    
    // Log configuration change
    await this.logAction(
      'system',
      'anti_theft_config_updated',
      { oldConfig: this.config, newConfig: this.config }
    );

    return this.config;
  }

  /**
   * Get current configuration
   */
  getConfig(): AntiTheftConfig {
    return { ...this.config };
  }
}
