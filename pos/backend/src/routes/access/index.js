const express = require('express');
const router = express.Router();
const roleRoutes = require('./role.routes');
const permissionRoutes = require('./permission.routes');
const authRoutes = require('./auth.routes');
const { authenticate, checkPermission } = require('../../middleware/auth.middleware');

// Public auth routes (login, refresh token, etc.)
router.use('/auth', authRoutes);

// Protected routes (require authentication)
router.use(authenticate);

// Role management routes (admin only)
router.use(
  '/roles',
  checkPermission('roles', 'read'),
  roleRoutes
);

// Permission management routes (admin only)
router.use(
  '/permissions',
  checkPermission('permissions', 'read'),
  permissionRoutes
);

// User management routes (to be implemented)
// router.use('/users', userRoutes);

// Audit log routes (admin only)
router.get(
  '/audit-logs',
  checkPermission('audit', 'read'),
  async (req, res, next) => {
    try {
      const { 
        page = 1, 
        limit = 50, 
        action, 
        resourceType, 
        resourceId, 
        userId,
        startDate,
        endDate
      } = req.query;

      const { getAuditLogs, getAuditLogsCount } = require('../../services/audit.service');
      
      const logs = await getAuditLogs({
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100), // Cap at 100 items per page
        action,
        resourceType,
        resourceId,
        userId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      });

      const total = await getAuditLogsCount({
        action,
        resourceType,
        resourceId,
        userId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      });

      res.json({
        data: logs,
        meta: {
          total,
          page: parseInt(page),
          limit: Math.min(parseInt(limit), 100),
          totalPages: Math.ceil(total / Math.min(parseInt(limit), 100))
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Export the permissions and resources for frontend
router.get(
  '/permissions/meta',
  checkPermission('permissions', 'read'),
  async (req, res, next) => {
    try {
      const permissionController = require('../../controllers/access/permission.controller');
      const [resources, actions] = await Promise.all([
        permissionController.getResourceList(),
        permissionController.getActionList()
      ]);
      
      res.json({
        resources,
        actions,
        defaultPermissions: [
          { resource: 'users', action: 'read' },
          { resource: 'roles', action: 'read' },
          { resource: 'permissions', action: 'read' },
          { resource: 'audit', action: 'read' },
        ]
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
