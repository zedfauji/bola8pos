const express = require('express');
const router = express.Router();
const { checkPermission } = require('../middleware/auth.middleware');

// Minimal placeholder to unblock server startup
router.get('/health', checkPermission('reports', 'read'), (_req, res) =>
  res.json({ ok: true, service: 'reports' })
);

module.exports = router;
