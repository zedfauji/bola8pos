const express = require('express');
const router = express.Router();

const tableRoutes = require('./tableRoutes');
const memberRoutes = require('./memberRoutes');
const orderRoutes = require('./orderRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const employeeRoutes = require('./employeeRoutes');
const authRoutes = require('./authRoutes');

router.get('/', (req, res) => {
  res.json({ service: 'Billiard POS API', status: 'OK' });
});

router.use('/tables', tableRoutes);
router.use('/members', memberRoutes);
router.use('/orders', orderRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/employees', employeeRoutes);
router.use('/auth', authRoutes);

module.exports = router;
