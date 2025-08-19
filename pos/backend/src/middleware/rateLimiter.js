const rateLimit = require('express-rate-limit');
const { TooManyRequestsError } = require('../utils/errors');

// In development, relax rate limiting to avoid blocking local testing
const isProd = process.env.NODE_ENV === 'production';
const passThrough = (req, _res, next) => next();

/**
 * Creates a rate limiter with standardized error handling
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message
 * @returns {Function} Express middleware
 */
const createLimiter = (options) => {
  if (!isProd) return passThrough;
  
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, limiterOptions) => {
      throw new TooManyRequestsError(options.message || 'Too many requests, please try again later.', {
        retryAfter: limiterOptions.windowMs / 1000,
        limit: limiterOptions.max,
        resetTime: new Date(Date.now() + limiterOptions.windowMs).toISOString()
      });
    },
    // Skip rate limiting for trusted IPs if configured
    skip: (req) => {
      const trustedIps = process.env.TRUSTED_IPS ? process.env.TRUSTED_IPS.split(',') : [];
      return trustedIps.includes(req.ip);
    },
    keyGenerator: (req) => {
      // Use X-Forwarded-For if behind a proxy, otherwise use IP
      return req.headers['x-forwarded-for'] || req.ip;
    }
  });
};

// General API rate limiting
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

// More aggressive rate limiting for auth endpoints
const authLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 requests per hour for auth endpoints
  message: 'Too many login attempts, please try again later.'
});

// Specific login endpoint rate limiting
const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts from this IP, please try again after 15 minutes.'
});

// Rate limiting for public APIs
const publicApiLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  message: 'Too many requests to public API, please try again later.'
});

// Rate limiting for sensitive operations
const sensitiveOpLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many sensitive operations attempted, please try again later.'
});

// Rate limiting for reporting endpoints
const reportingLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // 15 requests per 5 minutes
  message: 'Too many reporting requests, please try again later.'
});

module.exports = {
  apiLimiter,
  authLimiter,
  loginLimiter,
  publicApiLimiter,
  sensitiveOpLimiter,
  reportingLimiter
};
