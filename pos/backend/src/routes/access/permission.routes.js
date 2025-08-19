const express = require('express');
const router = express.Router();
const permissionController = require('../../controllers/access/permission.controller');
const { checkPermission } = require('../../middleware/auth.middleware');

// Create a new permission
router.post(
  '/',
  checkPermission('permissions', 'create'),
  async (req, res, next) => {
    try {
      const permission = await permissionController.createPermission(req.body, req.user.id);
      res.status(201).json(permission);
    } catch (error) {
      next(error);
    }
  }
);

// List permissions with pagination and filtering
router.get(
  '/',
  checkPermission('permissions', 'read'),
  async (req, res, next) => {
    try {
      const { 
        page = 1, 
        limit = 50, 
        resource, 
        action, 
        search = '' 
      } = req.query;

      const result = await permissionController.listPermissions({
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100), // Cap at 100 items per page
        resource,
        action,
        search
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get a single permission by ID
router.get(
  '/:id',
  checkPermission('permissions', 'read'),
  async (req, res, next) => {
    try {
      const permission = await permissionController.getPermissionById(req.params.id);
      res.json(permission);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a permission
router.delete(
  '/:id',
  checkPermission('permissions', 'delete'),
  async (req, res, next) => {
    try {
      await permissionController.deletePermission(req.params.id, req.user.id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

// Get unique resource names
router.get(
  '/resources/list',
  checkPermission('permissions', 'read'),
  async (req, res, next) => {
    try {
      const resources = await permissionController.getResourceList();
      res.json(resources);
    } catch (error) {
      next(error);
    }
  }
);

// Get unique action names
router.get(
  '/actions/list',
  checkPermission('permissions', 'read'),
  async (req, res, next) => {
    try {
      const actions = await permissionController.getActionList();
      res.json(actions);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
