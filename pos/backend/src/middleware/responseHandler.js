/**
 * Response handler middleware
 * Standardizes API responses across the application
 */

/**
 * Middleware to standardize successful API responses
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function responseHandler(req, res, next) {
  // Store the original res.json method
  const originalJson = res.json;
  const originalSend = res.send;

  // Override the res.json method
  res.json = function(data) {
    // Skip if headers already sent or response is a stream
    if (res.headersSent || data instanceof Buffer || data instanceof Uint8Array) {
      return originalJson.call(this, data);
    }

    // Skip standardization for error responses (handled by error middleware)
    if (res.statusCode >= 400) {
      // If the error response is already in our standard format, don't modify it
      if (data && data.status && data.message) {
        return originalJson.call(this, data);
      }
      
      // Otherwise, let the error handler middleware handle it
      return originalJson.call(this, data);
    }

    // If data is already wrapped in our standard format, don't wrap it again
    if (data && (data.success !== undefined || data.data !== undefined)) {
      return originalJson.call(this, data);
    }

    // Format the response
    const formattedResponse = {
      success: true,
      data: data || null,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    };

    // Add pagination metadata if present
    if (data && data.pagination) {
      formattedResponse.pagination = data.pagination;
      delete formattedResponse.data.pagination;
    }

    // Call the original method with our formatted response
    return originalJson.call(this, formattedResponse);
  };

  // Override the res.send method for non-JSON responses
  res.send = function(data) {
    // Skip if headers already sent or not JSON content type
    if (res.headersSent || 
        !res.get('Content-Type')?.includes('application/json') ||
        typeof data !== 'object' ||
        data instanceof Buffer ||
        data instanceof Uint8Array) {
      return originalSend.call(this, data);
    }

    // For JSON responses, use our standardized json method
    return res.json(data);
  };

  // Add success response helpers
  res.success = function(data, message = 'Success') {
    return res.json({
      success: true,
      message,
      data: data || null
    });
  };

  res.created = function(data, message = 'Resource created successfully') {
    return res.status(201).json({
      success: true,
      message,
      data: data || null
    });
  };

  // Add standardized error response helpers
  res.error = function(status, message, details = null) {
    const errorResponse = {
      status,
      message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    };
    
    if (details) {
      errorResponse.details = details;
    }
    
    return res.status(status).json(errorResponse);
  };

  res.badRequest = function(message = 'Bad request', details = null) {
    return res.error(400, message, details);
  };

  res.unauthorized = function(message = 'Unauthorized', details = null) {
    return res.error(401, message, details);
  };

  res.forbidden = function(message = 'Forbidden', details = null) {
    return res.error(403, message, details);
  };

  res.notFound = function(message = 'Resource not found', details = null) {
    return res.error(404, message, details);
  };

  res.noContent = function() {
    return res.status(204).end();
  };

  next();
}

module.exports = responseHandler;
