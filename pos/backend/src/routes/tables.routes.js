const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const tableController = require('../controllers/tables/table.controller');
const layoutController = require('../controllers/tables/layout.controller');
const sessionController = require('../controllers/tables/session.controller');
const tariffController = require('../controllers/tables/tariff.controller');

const router = express.Router();

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(uploadsDir, 'layouts');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'layout-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|svg/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Apply authentication middleware to all routes
router.use(authenticate);

// Table Routes
router.get('/tables', authorize(['admin', 'manager', 'staff']), tableController.getTables);
router.get('/tables/:id', authorize(['admin', 'manager', 'staff']), tableController.getTable);
router.post('/tables', authorize(['admin', 'manager']), tableController.createTable);
router.put('/tables/:id', authorize(['admin', 'manager']), tableController.updateTable);
// Allow PATCH as an alias for partial updates used by the frontend
router.patch('/tables/:id', authorize(['admin', 'manager']), tableController.updateTable);
router.delete('/tables/:id', authorize(['admin']), tableController.deleteTable);
router.put('/tables/positions', authorize(['admin', 'manager']), tableController.updateTablePositions);
router.put('/tables/:id/status', authorize(['admin', 'manager', 'staff']), tableController.updateTableStatus);
// Allow PATCH for status updates as well
router.patch('/tables/:id/status', authorize(['admin', 'manager', 'staff']), tableController.updateTableStatus);

// Table Layout Routes
router.get('/table-layouts', authorize(['admin', 'manager', 'staff']), layoutController.getLayouts);
// Active layout endpoint expected by frontend
router.get('/table-layouts/active', authorize(['admin', 'manager', 'staff']), layoutController.getActiveLayout);
router.get('/table-layouts/:id', authorize(['admin', 'manager', 'staff']), layoutController.getLayout);
router.post(
  '/table-layouts', 
  authorize(['admin', 'manager']), 
  upload.single('floorPlanImage'),
  layoutController.createLayout
);
router.put(
  '/table-layouts/:id', 
  authorize(['admin', 'manager']), 
  upload.single('floorPlanImage'),
  layoutController.updateLayout
);
router.delete('/table-layouts/:id', authorize(['admin']), layoutController.deleteLayout);
router.post('/table-layouts/:id/duplicate', authorize(['admin', 'manager']), layoutController.duplicateLayout);
router.put('/table-layouts/:id/activate', authorize(['admin', 'manager']), layoutController.activateLayout);

// Table Session Routes
router.get('/sessions', authorize(['admin', 'manager', 'staff']), sessionController.getSessions);
router.get('/sessions/active', authorize(['admin', 'manager', 'staff']), sessionController.getActiveSessions);
router.get('/sessions/:id', authorize(['admin', 'manager', 'staff']), sessionController.getSession);
router.post('/sessions', authorize(['admin', 'manager', 'staff']), sessionController.startSession);
router.post('/sessions/:id/pause', authorize(['admin', 'manager', 'staff']), sessionController.pauseSession);
router.post('/sessions/:id/resume', authorize(['admin', 'manager', 'staff']), sessionController.resumeSession);
router.post('/sessions/:id/end', authorize(['admin', 'manager', 'staff']), sessionController.endSession);
router.post('/sessions/:id/services', authorize(['admin', 'manager', 'staff']), sessionController.addServiceToSession);
router.delete('/sessions/:id/services/:serviceId', authorize(['admin', 'manager', 'staff']), sessionController.removeServiceFromSession);

// Tariff Routes
router.get('/tariffs', authorize(['admin', 'manager', 'staff']), tariffController.getTariffs);
router.get('/tariffs/applicable', tariffController.getApplicableTariffs); // Public endpoint
router.get('/tariffs/:id', authorize(['admin', 'manager', 'staff']), tariffController.getTariff);
router.post('/tariffs', authorize(['admin', 'manager']), tariffController.createTariff);
router.put('/tariffs/:id', authorize(['admin', 'manager']), tariffController.updateTariff);
router.delete('/tariffs/:id', authorize(['admin']), tariffController.deleteTariff);

module.exports = router;
