// Minimal auth middleware placeholder
// TODO: Replace with real JWT/session-based auth and RBAC

function authenticate(req, _res, next) {
  // If upstream has already set user, keep it; else default to a demo user
  if (!req.user) {
    req.user = { id: 'demo-user', role: 'admin', name: 'Demo' };
  }
  next();
}

function authorize(allowedRoles = []) {
  return (req, res, next) => {
    const role = req.user?.role || 'guest';
    if (allowedRoles.length === 0 || allowedRoles.includes(role)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

module.exports = { authenticate, authorize };
