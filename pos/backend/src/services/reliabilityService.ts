import { AuthService } from './auth.service';
import { AntiTheftService } from './antiTheftService';
import { Employee, Alert, AuditLog } from '../models';

export interface BackupConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly';
  retentionDays: number;
  storageType: 'local' | 's3' | 'gcs';
  storageConfig: {
    bucket?: string;
    region?: string;
    accessKey?: string;
    secretKey?: string;
    endpoint?: string;
  };
  encryptBackups: boolean;
  compressionEnabled: boolean;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'AES-256-GCM' | 'AES-256-CBC';
  keyRotationDays: number;
  encryptFields: string[];
  masterKey?: string;
}

export interface ErrorLogConfig {
  enabled: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxLogSize: number;
  retentionDays: number;
  externalService: 'sentry' | 'loggly' | 'none';
  externalConfig?: {
    dsn?: string;
    environment?: string;
    tags?: Record<string, string>;
  };
}

export interface RedundancyConfig {
  enabled: boolean;
  primaryRegion: string;
  failoverRegion: string;
  healthCheckInterval: number;
  autoFailover: boolean;
  dataSyncEnabled: boolean;
  syncInterval: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  lastBackup: string;
  lastHealthCheck: string;
  activeAlerts: number;
  systemUptime: number;
  databaseConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
}

export class ReliabilityService {
  private static instance: ReliabilityService;
  private authService: AuthService;
  private antiTheftService: AntiTheftService;
  
  private backupConfig: BackupConfig;
  private encryptionConfig: EncryptionConfig;
  private errorLogConfig: ErrorLogConfig;
  private redundancyConfig: RedundancyConfig;
  
  private lastBackup: string | null = null;
  private systemStartTime: number = Date.now();
  private healthMetrics: Map<string, any> = new Map();

  private constructor() {
    this.authService = AuthService.getInstance();
    this.antiTheftService = AntiTheftService.getInstance();
    
    this.backupConfig = {
      enabled: true,
      frequency: 'daily',
      retentionDays: 30,
      storageType: 'gcs',
      storageConfig: {
        bucket: 'billiard-pos-backups',
        region: 'us-central1'
      },
      encryptBackups: true,
      compressionEnabled: true
    };

    this.encryptionConfig = {
      enabled: true,
      algorithm: 'AES-256-GCM',
      keyRotationDays: 90,
      encryptFields: ['paymentInfo', 'personalData', 'accessCodes'],
      masterKey: process.env.ENCRYPTION_MASTER_KEY
    };

    this.errorLogConfig = {
      enabled: true,
      logLevel: 'error',
      maxLogSize: 100 * 1024 * 1024, // 100MB
      retentionDays: 90,
      externalService: 'sentry',
      externalConfig: {
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tags: { service: 'billiard-pos' }
      }
    };

    this.redundancyConfig = {
      enabled: true,
      primaryRegion: 'us-central1',
      failoverRegion: 'us-east1',
      healthCheckInterval: 30000, // 30 seconds
      autoFailover: true,
      dataSyncEnabled: true,
      syncInterval: 300000 // 5 minutes
    };

    this.initializeService();
  }

  public static getInstance(): ReliabilityService {
    if (!ReliabilityService.instance) {
      ReliabilityService.instance = new ReliabilityService();
    }
    return ReliabilityService.instance;
  }

  /**
   * Initialize the reliability service
   */
  private async initializeService(): Promise<void> {
    if (this.backupConfig.enabled) {
      this.scheduleBackups();
    }

    if (this.redundancyConfig.enabled) {
      this.startHealthMonitoring();
    }

    if (this.errorLogConfig.enabled) {
      this.setupErrorLogging();
    }

    // Log service initialization
    await this.antiTheftService.logAction(
      'system',
      'reliability_service_initialized',
      { config: this.getConfig() }
    );
  }

  /**
   * Schedule automatic backups
   */
  private scheduleBackups(): void {
    const interval = this.getBackupInterval();
    
    setInterval(async () => {
      try {
        await this.performBackup();
      } catch (error) {
        await this.logError('Backup failed', error);
      }
    }, interval);
  }

  /**
   * Get backup interval in milliseconds
   */
  private getBackupInterval(): number {
    switch (this.backupConfig.frequency) {
      case 'hourly': return 60 * 60 * 1000;
      case 'daily': return 24 * 60 * 60 * 1000;
      case 'weekly': return 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Perform a backup
   */
  async performBackup(): Promise<{
    success: boolean;
    backupId: string;
    size: number;
    timestamp: string;
    location: string;
  }> {
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    try {
      // Create backup data
      const backupData = await this.createBackupData();
      
      // Compress if enabled
      let processedData = backupData;
      if (this.backupConfig.compressionEnabled) {
        processedData = await this.compressData(backupData);
      }

      // Encrypt if enabled
      if (this.backupConfig.encryptBackups) {
        processedData = await this.encryptData(processedData);
      }

      // Upload to storage
      const location = await this.uploadBackup(backupId, processedData);
      
      // Update last backup time
      this.lastBackup = timestamp;
      
      // Log successful backup
      await this.antiTheftService.logAction(
        'system',
        'backup_completed',
        { backupId, size: processedData.length, location }
      );

      // Clean up old backups
      await this.cleanupOldBackups();

      return {
        success: true,
        backupId,
        size: processedData.length,
        timestamp,
        location
      };

    } catch (error) {
      await this.logError('Backup failed', error);
      throw error;
    }
  }

  /**
   * Create backup data from all collections
   */
  private async createBackupData(): Promise<string> {
    // Mock implementation - replace with actual data export
    const backupData = {
      timestamp: new Date().toISOString(),
      collections: {
        tables: [],
        orders: [],
        employees: [],
        inventory: [],
        transactions: [],
        auditLogs: []
      },
      metadata: {
        version: '1.0.0',
        totalRecords: 0,
        checksum: 'mock-checksum'
      }
    };

    return JSON.stringify(backupData);
  }

  /**
   * Compress data using gzip
   */
  private async compressData(data: string): Promise<Buffer> {
    // Mock implementation - replace with actual compression
    return Buffer.from(data, 'utf8');
  }

  /**
   * Encrypt data using configured algorithm
   */
  private async encryptData(data: Buffer): Promise<Buffer> {
    if (!this.encryptionConfig.enabled || !this.encryptionConfig.masterKey) {
      return data;
    }

    // Mock implementation - replace with actual encryption
    // const cipher = crypto.createCipher(this.encryptionConfig.algorithm, this.encryptionConfig.masterKey);
    // return Buffer.concat([cipher.update(data), cipher.final()]);
    
    return data;
  }

  /**
   * Upload backup to configured storage
   */
  private async uploadBackup(backupId: string, data: Buffer): Promise<string> {
    // Mock implementation - replace with actual upload logic
    const location = `${this.backupConfig.storageType}://${this.backupConfig.storageConfig.bucket}/${backupId}`;
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return location;
  }

  /**
   * Clean up old backups based on retention policy
   */
  private async cleanupOldBackups(): Promise<void> {
    // Mock implementation - replace with actual cleanup logic
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.backupConfig.retentionDays);
    
    // Delete backups older than retention period
    // await this.deleteOldBackups(cutoffDate);
  }

  /**
   * Start health monitoring for redundancy
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        await this.logError('Health check failed', error);
      }
    }, this.redundancyConfig.healthCheckInterval);
  }

  /**
   * Perform system health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    const currentTime = Date.now();
    const uptime = currentTime - this.systemStartTime;
    
    // Mock health metrics - replace with actual system monitoring
    const health: SystemHealth = {
      status: 'healthy',
      lastBackup: this.lastBackup || 'Never',
      lastHealthCheck: new Date().toISOString(),
      activeAlerts: 0,
      systemUptime: uptime,
      databaseConnections: 5,
      memoryUsage: 75,
      cpuUsage: 45,
      diskUsage: 60
    };

    // Update health metrics
    this.healthMetrics.set('lastHealthCheck', health);
    
    // Check if failover is needed
    if (this.redundancyConfig.autoFailover && health.status === 'critical') {
      await this.initiateFailover();
    }

    return health;
  }

  /**
   * Initiate failover to backup region
   */
  private async initiateFailover(): Promise<void> {
    try {
      // Mock failover implementation
      await this.antiTheftService.logAction(
        'system',
        'failover_initiated',
        { 
          fromRegion: this.redundancyConfig.primaryRegion,
          toRegion: this.redundancyConfig.failoverRegion,
          reason: 'System health critical'
        }
      );

      // Switch to failover region
      // await this.switchToFailoverRegion();
      
    } catch (error) {
      await this.logError('Failover failed', error);
    }
  }

  /**
   * Setup error logging with external service
   */
  private setupErrorLogging(): void {
    if (this.errorLogConfig.externalService === 'sentry') {
      // Mock Sentry setup - replace with actual Sentry initialization
      // Sentry.init({
      //   dsn: this.errorLogConfig.externalConfig?.dsn,
      //   environment: this.errorLogConfig.externalConfig?.environment,
      //   tags: this.errorLogConfig.externalConfig?.tags
      // });
    }
  }

  /**
   * Log error with configured error logging service
   */
  async logError(message: string, error: any): Promise<void> {
    const errorLog = {
      timestamp: new Date().toISOString(),
      message,
      error: error instanceof Error ? error.stack : error,
      level: this.errorLogConfig.logLevel,
      context: {
        service: 'billiard-pos',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // Log to external service if configured
    if (this.errorLogConfig.externalService === 'sentry') {
      // Sentry.captureException(error);
    }

    // Log to audit system
    await this.antiTheftService.logAction(
      'system',
      'error_logged',
      errorLog
    );

    // Check if error requires alert
    if (this.shouldCreateAlert(error)) {
      await this.createErrorAlert(errorLog);
    }
  }

  /**
   * Determine if error should create an alert
   */
  private shouldCreateAlert(error: any): boolean {
    // Create alerts for critical errors
    const criticalErrors = [
      'database_connection_failed',
      'backup_failed',
      'encryption_error',
      'failover_failed'
    ];

    return criticalErrors.some(criticalError => 
      error.message?.includes(criticalError) || 
      error.code?.includes(criticalError)
    );
  }

  /**
   * Create alert for critical error
   */
  private async createErrorAlert(errorLog: any): Promise<Alert> {
    const alert: Alert = {
      id: `alert_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'system_error',
      severity: 'critical',
      message: `Critical system error: ${errorLog.message}`,
      details: JSON.stringify(errorLog),
      employeeId: 'system',
      requiresAction: true,
      status: 'active'
    };

    // Save alert
    // await this.saveAlert(alert);

    return alert;
  }

  /**
   * Encrypt sensitive data fields
   */
  async encryptSensitiveData(data: any): Promise<any> {
    if (!this.encryptionConfig.enabled) {
      return data;
    }

    const encryptedData = { ...data };
    
    for (const field of this.encryptionConfig.encryptFields) {
      if (encryptedData[field]) {
        encryptedData[field] = await this.encryptField(encryptedData[field]);
      }
    }

    return encryptedData;
  }

  /**
   * Encrypt a single field
   */
  private async encryptField(value: string): Promise<string> {
    if (!this.encryptionConfig.masterKey) {
      return value;
    }

    // Mock encryption - replace with actual encryption
    // const cipher = crypto.createCipher(this.encryptionConfig.algorithm, this.encryptionConfig.masterKey);
    // const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    // return encrypted.toString('base64');
    
    return `encrypted_${value}`;
  }

  /**
   * Decrypt sensitive data fields
   */
  async decryptSensitiveData(data: any): Promise<any> {
    if (!this.encryptionConfig.enabled) {
      return data;
    }

    const decryptedData = { ...data };
    
    for (const field of this.encryptionConfig.encryptFields) {
      if (decryptedData[field] && decryptedData[field].startsWith('encrypted_')) {
        decryptedData[field] = await this.decryptField(decryptedData[field]);
      }
    }

    return decryptedData;
  }

  /**
   * Decrypt a single field
   */
  private async decryptField(encryptedValue: string): Promise<string> {
    if (!this.encryptionConfig.masterKey) {
      return encryptedValue;
    }

    // Mock decryption - replace with actual decryption
    // const decipher = crypto.createDecipher(this.encryptionConfig.algorithm, this.encryptionConfig.masterKey);
    // const decrypted = Buffer.concat([decipher.update(encryptedValue, 'base64'), decipher.final()]);
    // return decrypted.toString('utf8');
    
    return encryptedValue.replace('encrypted_', '');
  }

  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth | null {
    return this.healthMetrics.get('lastHealthCheck') || null;
  }

  /**
   * Get service configuration
   */
  getConfig(): {
    backup: BackupConfig;
    encryption: EncryptionConfig;
    errorLog: ErrorLogConfig;
    redundancy: RedundancyConfig;
  } {
    return {
      backup: { ...this.backupConfig },
      encryption: { ...this.encryptionConfig },
      errorLog: { ...this.errorLogConfig },
      redundancy: { ...this.redundancyConfig }
    };
  }

  /**
   * Update service configuration
   */
  async updateConfig(
    section: 'backup' | 'encryption' | 'errorLog' | 'redundancy',
    newConfig: Partial<BackupConfig | EncryptionConfig | ErrorLogConfig | RedundancyConfig>
  ): Promise<void> {
    switch (section) {
      case 'backup':
        this.backupConfig = { ...this.backupConfig, ...newConfig };
        break;
      case 'encryption':
        this.encryptionConfig = { ...this.encryptionConfig, ...newConfig };
        break;
      case 'errorLog':
        this.errorLogConfig = { ...this.errorLogConfig, ...newConfig };
        break;
      case 'redundancy':
        this.redundancyConfig = { ...this.redundancyConfig, ...newConfig };
        break;
    }

    // Log configuration change
    await this.antiTheftService.logAction(
      'system',
      'reliability_config_updated',
      { section, newConfig }
    );

    // Reinitialize service if needed
    if (section === 'backup' && this.backupConfig.enabled) {
      this.scheduleBackups();
    }
  }
}
