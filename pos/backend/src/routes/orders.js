const express = require('express');
const router = express.Router();

// Minimal placeholder to unblock server startup
router.get('/health', (_req, res) => res.json({ ok: true, service: 'orders' }));

module.exports = router;
