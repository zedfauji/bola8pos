/**
 * Simple logger utility for consistent logging across the application
 */

const logger = {
  info: (message, ...args) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  
  warn: (message, ...args) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  
  error: (message, ...args) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  
  debug: (message, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  
  // For transaction logging
  transaction: (message, ...args) => {
    console.log(`[TRANSACTION] ${message}`, ...args);
  },
  
  // For audit logging
  audit: (message, ...args) => {
    console.log(`[AUDIT] ${message}`, ...args);
  }
};

module.exports = logger;
