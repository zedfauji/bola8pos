class CustomError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode || 500;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class UnauthorizedError extends CustomError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, details);
  }
}

class ForbiddenError extends CustomError {
  constructor(message = 'Forbidden', details = null) {
    super(message, 403, details);
  }
}

class ValidationError extends CustomError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400, { errors });
    this.errors = errors;
  }
}

class NotFoundError extends CustomError {
  constructor(resource, id) {
    super(`${resource} not found${id ? ` with ID: ${id}` : ''}`, 404);
  }
}

class ConflictError extends CustomError {
  constructor(message = 'Resource already exists', details = null) {
    super(message, 409, details);
  }
}

class TooManyRequestsError extends CustomError {
  constructor(message = 'Too many requests', details = null) {
    super(message, 429, details);
    this.retryAfter = details?.retryAfter;
    this.limit = details?.limit;
    this.resetTime = details?.resetTime;
  }
}

// Error handling middleware
function errorHandler(err, req, res, next) {
  const status = err?.statusCode || err?.status || 500;
  const isAuthErr = status === 401 || status === 403 || err instanceof UnauthorizedError || err instanceof ForbiddenError;

  if (isAuthErr) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`AuthError ${status}: ${err.message} ${req?.method} ${req?.originalUrl}`);
    }
  } else {
    console.error('Error:', err);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'The provided token is invalid or malformed'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Your session has expired. Please log in again.'
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError' || err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details || err.errors
    });
  }

  // Handle custom errors
  if (err instanceof CustomError) {
    const response = {
      error: err.name.replace('Error', ''),
      message: err.message,
      ...(err.details && { details: err.details })
    };

    // Add rate limit headers if this is a rate limit error
    if (err instanceof TooManyRequestsError) {
      res.setHeader('Retry-After', err.retryAfter || 60);
      if (err.limit) res.setHeader('X-RateLimit-Limit', err.limit);
      if (err.retryAfter) res.setHeader('X-RateLimit-Reset', new Date(Date.now() + (err.retryAfter * 1000)).toISOString());
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle database errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'A resource with this identifier already exists',
      details: err.sqlMessage
    });
  }

  // Handle other database errors
  if (err.code && err.code.startsWith('ER_')) {
    return res.status(400).json({
      error: 'Database Error',
      message: 'An error occurred while processing your request',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  // Default error handler
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
}

module.exports = {
  CustomError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  errorHandler,
  // Factory compatible with existing imports throughout controllers
  // Usage: throw createError(400, 'Bad request')
  createError: (status, message, details = null) => {
    switch (status) {
      case 400:
        return new ValidationError(message || 'Validation failed', details?.errors || []);
      case 401:
        return new UnauthorizedError(message || 'Unauthorized', details);
      case 403:
        return new ForbiddenError(message || 'Forbidden', details);
      case 404:
        return new NotFoundError(message || 'Resource', details?.id);
      case 409:
        return new ConflictError(message || 'Resource already exists', details);
      case 429:
        return new TooManyRequestsError(message || 'Too many requests', details);
      default:
        return new CustomError(message || 'Error', status || 500, details);
    }
  }
};
