const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/register', authenticate, authorize(['admin']), employeeController.registerEmployee);
router.post('/login', employeeController.loginEmployee);
router.get('/', authenticate, authorize(['admin', 'manager']), employeeController.getAllEmployees);
router.post('/shifts/start', authenticate, employeeController.startShift);
router.post('/shifts/end', authenticate, employeeController.endShift);

module.exports = router;
