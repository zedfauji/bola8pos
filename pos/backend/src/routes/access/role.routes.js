const express = require('express');
const router = express.Router();
const roleController = require('../../controllers/access/role.controller');
const { checkPermission } = require('../../middleware/auth.middleware');

// Create a new role
router.post(
  '/',
  checkPermission('roles', 'create'),
  async (req, res, next) => {
    try {
      const role = await roleController.createRole(req.body, req.user.id);
      res.status(201).json(role);
    } catch (error) {
      next(error);
    }
  }
);

// List all roles with pagination
router.get(
  '/',
  checkPermission('roles', 'read'),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const result = await roleController.listRoles({
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50), // Cap at 50 items per page
        search
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get a single role by ID
router.get(
  '/:id',
  checkPermission('roles', 'read'),
  async (req, res, next) => {
    try {
      const role = await roleController.getRoleById(req.params.id);
      res.json(role);
    } catch (error) {
      next(error);
    }
  }
);

// Update a role
router.put(
  '/:id',
  checkPermission('roles', 'update'),
  async (req, res, next) => {
    try {
      const role = await roleController.updateRole(
        req.params.id, 
        req.body, 
        req.user.id
      );
      res.json(role);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a role
router.delete(
  '/:id',
  checkPermission('roles', 'delete'),
  async (req, res, next) => {
    try {
      await roleController.deleteRole(req.params.id, req.user.id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

// Get all available permissions
router.get(
  '/:id/permissions',
  checkPermission('roles', 'read'),
  async (req, res, next) => {
    try {
      const permissions = await roleController.getAllPermissions();
      res.json(permissions);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
