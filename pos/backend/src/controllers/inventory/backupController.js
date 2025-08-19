/**
 * Backup Controller
 * Handles backup and restore operations for inventory data
 */

const path = require('path');
const { createError } = require('../../utils/errorHandler');
const backupRestore = require('../../utils/backupRestore');

// Default backup directory
const BACKUP_DIR = path.join(__dirname, '../../../backups');

/**
 * Create a new backup
 * @route POST /api/inventory/backup
 */
exports.createBackup = async (req, res, next) => {
  try {
    const { collections } = req.body;
    
    const backupResult = await backupRestore.createBackup({
      backupDir: BACKUP_DIR,
      collections,
      user: req.user
    });
    
    res.status(201).json(backupResult);
  } catch (error) {
    next(createError(500, `Backup creation failed: ${error.message}`));
  }
};

/**
 * List all available backups
 * @route GET /api/inventory/backup
 */
exports.listBackups = async (req, res, next) => {
  try {
    const backups = await backupRestore.listBackups(BACKUP_DIR);
    
    res.json({
      count: backups.length,
      backups
    });
  } catch (error) {
    next(createError(500, `Failed to list backups: ${error.message}`));
  }
};

/**
 * Get details of a specific backup
 * @route GET /api/inventory/backup/:filename
 */
exports.getBackupDetails = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const backupFile = path.join(BACKUP_DIR, filename);
    
    const backupDetails = await backupRestore.getBackupDetails(backupFile);
    
    res.json(backupDetails);
  } catch (error) {
    next(createError(404, `Backup not found or invalid: ${error.message}`));
  }
};

/**
 * Restore from a backup
 * @route POST /api/inventory/backup/:filename/restore
 */
exports.restoreBackup = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const { collections, clearExisting = false } = req.body;
    const backupFile = path.join(BACKUP_DIR, filename);
    
    // Validate backup file exists and is valid
    try {
      await backupRestore.getBackupDetails(backupFile);
    } catch (error) {
      return next(createError(404, `Backup not found or invalid: ${error.message}`));
    }
    
    // Perform restore
    const restoreResult = await backupRestore.restoreBackup({
      backupFile,
      collections,
      clearExisting,
      user: req.user
    });
    
    res.json(restoreResult);
  } catch (error) {
    next(createError(500, `Restore failed: ${error.message}`));
  }
};

/**
 * Delete a backup
 * @route DELETE /api/inventory/backup/:filename
 */
exports.deleteBackup = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const backupFile = path.join(BACKUP_DIR, filename);
    
    // Validate backup file exists
    try {
      await backupRestore.getBackupDetails(backupFile);
    } catch (error) {
      return next(createError(404, `Backup not found: ${error.message}`));
    }
    
    const deleteResult = await backupRestore.deleteBackup(backupFile);
    
    res.json(deleteResult);
  } catch (error) {
    next(createError(500, `Failed to delete backup: ${error.message}`));
  }
};
