/**
 * APP-LEVEL LOGGER INSTANCE
 *
 * This is the singleton logger instance used throughout the application.
 * Import this instead of creating new loggers.
 *
 * @example
 * ```typescript
 * import { logger } from '@shared/lib/logger-instance'
 *
 * logger.info('tab.opened', { tabId: tab.id })
 * logger.error('payment.failed', { tabId: tab.id }, error)
 * ```
 */

import { createLogger } from './logger';

// Get terminal ID from environment or default to POS-1
const TERMINAL_ID = (import.meta.env.VITE_TERMINAL_ID as string | undefined) || 'POS-1';

// Get app version from environment
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) || '0.0.0';

// Generate session ID (unique per app session)
const SESSION_ID = crypto.randomUUID();

/**
 * Global logger instance.
 *
 * Use this throughout the application for all logging.
 */
export const logger = createLogger({
  terminalId: TERMINAL_ID,
  appVersion: APP_VERSION,
  sessionId: SESSION_ID,
});

/**
 * Creates a contextual logger for a specific user/shift.
 *
 * Use this when you have user context available.
 *
 * @param userId - Current staff ID
 * @param shiftId - Current shift ID
 * @returns Contextual logger
 *
 * @example
 * ```typescript
 * const userLogger = createUserLogger(staff.id, shift.id)
 * userLogger.info('order.created', { orderId: order.id })
 * ```
 */
export function createUserLogger(userId: string, shiftId?: string) {
  return logger.child({
    userId,
    ...(shiftId !== undefined && { shiftId }),
  });
}

/**
 * Creates a contextual logger for a specific feature.
 *
 * Use this in feature modules to automatically namespace events.
 *
 * @param feature - Feature name (e.g., 'payment', 'pool-timer')
 * @returns Contextual logger with feature prefix
 *
 * @example
 * ```typescript
 * const paymentLogger = createFeatureLogger('payment')
 * paymentLogger.info('processed', { amount: 50.00 }) // logs "payment.processed"
 * ```
 */
export function createFeatureLogger(feature: string) {
  const featureLogger = logger.child({});

  return {
    debug: (event: string, payload?: Parameters<typeof logger.debug>[1]) => {
      featureLogger.debug(`${feature}.${event}`, payload);
    },
    info: (event: string, payload?: Parameters<typeof logger.info>[1]) => {
      featureLogger.info(`${feature}.${event}`, payload);
    },
    warn: (event: string, payload?: Parameters<typeof logger.warn>[1]) => {
      featureLogger.warn(`${feature}.${event}`, payload);
    },
    error: (
      event: string,
      payload?: Parameters<typeof logger.error>[1],
      originalError?: Parameters<typeof logger.error>[2]
    ) => {
      featureLogger.error(`${feature}.${event}`, payload, originalError);
    },
  };
}
