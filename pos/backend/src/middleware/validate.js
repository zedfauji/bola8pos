// Zod validation middleware
const { ZodError } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    if (!schema) return next();
    try {
      const data = schema.parse(req.body || {});
      req.validated = data;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors });
      }
      return res.status(400).json({ error: err.message || 'Invalid request' });
    }
  };
}

module.exports = validate;
