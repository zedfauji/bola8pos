const rateLimit = require('express-rate-limit');
const { TooManyRequestsError } = require('../utils/errors');

// In development, relax rate limiting to avoid blocking local testing
const isProd = process.env.NODE_ENV === 'production';
const passThrough = (req, _res, next) => next();

// Rate limiting configuration
const apiLimiter = isProd ? rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    throw new TooManyRequestsError('Too many requests, please try again later.', {
      retryAfter: options.windowMs / 1000,
      limit: options.max,
      resetTime: new Date(Date.now() + options.windowMs).toISOString()
    });
  }
}) : passThrough;

// More aggressive rate limiting for auth endpoints
const authLimiter = isProd ? rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 requests per hour for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    throw new TooManyRequestsError('Too many login attempts, please try again later.', {
      retryAfter: options.windowMs / 1000,
      limit: options.max,
      resetTime: new Date(Date.now() + options.windowMs).toISOString()
    });
  }
}) : passThrough;

// Rate limiting for public APIs
const publicApiLimiter = isProd ? rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    throw new TooManyRequestsError('Too many requests to public API, please try again later.');
  }
}) : passThrough;

module.exports = {
  apiLimiter,
  authLimiter,
  publicApiLimiter
};
