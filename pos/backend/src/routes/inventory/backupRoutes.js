/**
 * Backup Routes
 * Routes for backup and restore operations
 */

const express = require('express');
const router = express.Router();
const backupController = require('../../controllers/inventory/backupController');
const { authenticate, authorize } = require('../../middleware/auth');

// All backup routes require authentication and admin authorization
router.use(authenticate);
router.use(authorize(['admin']));

// Create a new backup
router.post('/', backupController.createBackup);

// List all available backups
router.get('/', backupController.listBackups);

// Get details of a specific backup
router.get('/:filename', backupController.getBackupDetails);

// Restore from a backup
router.post('/:filename/restore', backupController.restoreBackup);

// Delete a backup
router.delete('/:filename', backupController.deleteBackup);

module.exports = router;
