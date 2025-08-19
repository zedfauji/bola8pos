const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const { authenticate: authMiddleware, hasRole, checkPermission } = require('../middleware/auth.middleware');
const { auditLog } = require('../services/audit.service');
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
router.use(authMiddleware);

// Middleware to log configuration access attempts
const logConfigAccess = (action) => {
  return async (req, res, next) => {
    await auditLog({
      userId: req.user?.id || 'anonymous',
      action: `TABLE_CONFIG_${action}`,
      resourceType: 'TABLE_CONFIGURATION',
      resourceId: req.params.id,
      metadata: { 
        path: req.path, 
        method: req.method,
        userRole: req.user?.role,
        ip: req.ip 
      }
    });
    next();
  };
};

// Table Routes - Operational (Available to all authenticated users)
router.get('/tables', hasRole(['admin', 'manager', 'employee']), tableController.getTables);
router.get('/tables/:id', hasRole(['admin', 'manager', 'employee']), tableController.getTable);
router.get('/tables/stats', hasRole(['admin', 'manager', 'employee']), tableController.getTableStats);
router.get('/tables/attention', hasRole(['admin', 'manager', 'employee']), tableController.getTablesNeedingAttention);

// Table Status Updates - Operational (Available to employees and above)
router.put('/tables/:id/status', hasRole(['admin', 'manager', 'employee']), tableController.updateTableStatus);
router.patch('/tables/:id/status', hasRole(['admin', 'manager', 'employee']), tableController.updateTableStatus);

// Table Configuration - ADMIN ONLY with audit logging
router.post('/tables', logConfigAccess('CREATE'), hasRole(['admin']), tableController.createTable);
router.put('/tables/:id', logConfigAccess('UPDATE'), hasRole(['admin']), tableController.updateTable);
router.patch('/tables/:id', logConfigAccess('UPDATE'), hasRole(['admin']), tableController.updateTable);
router.delete('/tables/:id', logConfigAccess('DELETE'), hasRole(['admin']), tableController.deleteTable);
router.put('/tables/positions', logConfigAccess('POSITION_UPDATE'), hasRole(['admin']), tableController.updateTablePositions);

// Table Layout Routes - Read access for all authenticated users
router.get('/table-layouts', hasRole(['admin', 'manager', 'employee']), layoutController.getLayouts);
router.get('/table-layouts/active', hasRole(['admin', 'manager', 'employee']), layoutController.getActiveLayout);
router.get('/table-layouts/:id', hasRole(['admin', 'manager', 'employee']), layoutController.getLayout);

// Table Layout Configuration - ADMIN ONLY with audit logging
router.post(
  '/table-layouts', 
  logConfigAccess('LAYOUT_CREATE'),
  hasRole(['admin']), 
  upload.single('floorPlanImage'),
  layoutController.createLayout
);
router.put(
  '/table-layouts/:id', 
  logConfigAccess('LAYOUT_UPDATE'),
  hasRole(['admin']), 
  upload.single('floorPlanImage'),
  layoutController.updateLayout
);
router.delete('/table-layouts/:id', logConfigAccess('LAYOUT_DELETE'), hasRole(['admin']), layoutController.deleteLayout);
router.post('/table-layouts/:id/duplicate', logConfigAccess('LAYOUT_DUPLICATE'), hasRole(['admin']), layoutController.duplicateLayout);
router.put('/table-layouts/:id/activate', logConfigAccess('LAYOUT_ACTIVATE'), hasRole(['admin']), layoutController.activateLayout);

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

// Tariff Routes - Read access for operational users
router.get('/tariffs', hasRole(['admin', 'manager', 'employee']), tariffController.getTariffs);
router.get('/tariffs/applicable', tariffController.getApplicableTariffs); // Public endpoint
router.get('/tariffs/:id', hasRole(['admin', 'manager', 'employee']), tariffController.getTariff);

// Tariff Configuration - ADMIN ONLY with audit logging
router.post('/tariffs', logConfigAccess('TARIFF_CREATE'), hasRole(['admin']), tariffController.createTariff);
router.put('/tariffs/:id', logConfigAccess('TARIFF_UPDATE'), hasRole(['admin']), tariffController.updateTariff);
router.delete('/tariffs/:id', logConfigAccess('TARIFF_DELETE'), hasRole(['admin']), tariffController.deleteTariff);

module.exports = router;
