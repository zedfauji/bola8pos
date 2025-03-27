const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { authenticate, authorize } = require('../middleware/auth');

// Member management
router.post('/', authenticate, authorize(['cashier', 'manager']), memberController.createMember);
router.get('/:id', authenticate, memberController.getMemberById);
router.get('/qr/:qrCode', authenticate, memberController.getMemberByQR);
router.put('/:id/tier', authenticate, authorize(['manager']), memberController.updateMemberTier);
router.post('/:id/points', authenticate, authorize(['cashier', 'manager']), memberController.addMemberPoints);

module.exports = router;
