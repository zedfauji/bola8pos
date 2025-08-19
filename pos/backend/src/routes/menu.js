const express = require('express');
const router = express.Router();

// Placeholder routes to unblock server startup
router.get('/health', (_req, res) => res.json({ ok: true, service: 'menu' }));

module.exports = router;
