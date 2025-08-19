/**
 * Backup and Restore Utility for Inventory System
 * Handles exporting and importing data for backup and restore operations
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const { createError } = require('./errorHandler');

// Import all models that need to be backed up
const {
  Category,
  Location,
  Product,
  Inventory,
  StockMovement,
  Supplier,
  PurchaseOrder
} = require('../models');

// Map of model names to their mongoose models
const modelMap = {
  categories: Category,
  locations: Location,
  products: Product,
  inventory: Inventory,
  stockMovements: StockMovement,
  suppliers: Supplier,
  purchaseOrders: PurchaseOrder
};

// Default backup directory
const DEFAULT_BACKUP_DIR = path.join(__dirname, '../../backups');

/**
 * Ensure backup directory exists
 * @param {string} backupDir - Directory path for backups
 * @returns {Promise<string>} - Path to backup directory
 */
const ensureBackupDir = async (backupDir = DEFAULT_BACKUP_DIR) => {
  try {
    await mkdir(backupDir, { recursive: true });
    return backupDir;
  } catch (error) {
    throw new Error(`Failed to create backup directory: ${error.message}`);
  }
};

/**
 * Create a backup of specified collections
 * @param {Object} options - Backup options
 * @param {string} options.backupDir - Directory to store backup files
 * @param {Array<string>} options.collections - Collections to backup (default: all)
 * @param {Object} options.user - User performing the backup
 * @returns {Promise<Object>} - Backup result with metadata
 */
exports.createBackup = async (options = {}) => {
  const {
    backupDir = DEFAULT_BACKUP_DIR,
    collections = Object.keys(modelMap),
    user
  } = options;

  try {
    // Ensure backup directory exists
    const backupPath = await ensureBackupDir(backupDir);
    
    // Create timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `inventory_backup_${timestamp}.json`;
    const fullBackupPath = path.join(backupPath, backupFilename);
    
    // Object to store all backup data
    const backupData = {
      metadata: {
        timestamp: new Date().toISOString(),
        createdBy: user ? user._id : null,
        collections: [],
        version: '1.0'
      },
      data: {}
    };
    
    // Process each collection
    for (const collection of collections) {
      if (!modelMap[collection]) {
        console.warn(`Skipping unknown collection: ${collection}`);
        continue;
      }
      
      const Model = modelMap[collection];
      const documents = await Model.find({}).lean();
      
      backupData.data[collection] = documents;
      backupData.metadata.collections.push({
        name: collection,
        count: documents.length
      });
    }
    
    // Write backup file
    await writeFile(fullBackupPath, JSON.stringify(backupData, null, 2));
    
    return {
      success: true,
      filename: backupFilename,
      path: fullBackupPath,
      timestamp: backupData.metadata.timestamp,
      collections: backupData.metadata.collections
    };
  } catch (error) {
    throw new Error(`Backup failed: ${error.message}`);
  }
};

/**
 * List available backups
 * @param {string} backupDir - Directory containing backup files
 * @returns {Promise<Array>} - List of available backups with metadata
 */
exports.listBackups = async (backupDir = DEFAULT_BACKUP_DIR) => {
  try {
    await ensureBackupDir(backupDir);
    
    const files = await promisify(fs.readdir)(backupDir);
    const backupFiles = files.filter(file => 
      file.startsWith('inventory_backup_') && file.endsWith('.json')
    );
    
    const backups = [];
    
    for (const file of backupFiles) {
      try {
        const filePath = path.join(backupDir, file);
        const stats = await promisify(fs.stat)(filePath);
        const fileContent = await readFile(filePath, 'utf8');
        const backupData = JSON.parse(fileContent);
        
        backups.push({
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.mtime,
          metadata: backupData.metadata
        });
      } catch (error) {
        console.error(`Error reading backup file ${file}:`, error);
      }
    }
    
    // Sort by creation date (newest first)
    return backups.sort((a, b) => new Date(b.created) - new Date(a.created));
  } catch (error) {
    throw new Error(`Failed to list backups: ${error.message}`);
  }
};

/**
 * Restore data from a backup file
 * @param {Object} options - Restore options
 * @param {string} options.backupFile - Path to backup file
 * @param {Array<string>} options.collections - Collections to restore (default: all in backup)
 * @param {boolean} options.clearExisting - Whether to clear existing data before restore
 * @param {Object} options.user - User performing the restore
 * @returns {Promise<Object>} - Restore result with metadata
 */
exports.restoreBackup = async (options = {}) => {
  const {
    backupFile,
    collections,
    clearExisting = false,
    user
  } = options;
  
  if (!backupFile) {
    throw new Error('Backup file path is required');
  }
  
  // Start a session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Read and parse backup file
    const fileContent = await readFile(backupFile, 'utf8');
    const backupData = JSON.parse(fileContent);
    
    if (!backupData.metadata || !backupData.data) {
      throw new Error('Invalid backup file format');
    }
    
    const restoreCollections = collections || 
      backupData.metadata.collections.map(c => c.name);
    
    const results = {
      collections: [],
      totalRestored: 0
    };
    
    // Process each collection
    for (const collection of restoreCollections) {
      if (!modelMap[collection] || !backupData.data[collection]) {
        console.warn(`Skipping collection: ${collection} - not found in backup or model map`);
        continue;
      }
      
      const Model = modelMap[collection];
      const documentsToRestore = backupData.data[collection];
      
      // Clear existing data if requested
      if (clearExisting) {
        await Model.deleteMany({}).session(session);
      }
      
      // Handle references and prepare documents
      const preparedDocs = documentsToRestore.map(doc => {
        // Convert string IDs back to ObjectIds for references
        Object.keys(doc).forEach(key => {
          // Skip _id field which is handled by insertMany
          if (key === '_id') return;
          
          // Handle ObjectId references
          if (typeof doc[key] === 'string' && mongoose.Types.ObjectId.isValid(doc[key])) {
            doc[key] = mongoose.Types.ObjectId(doc[key]);
          }
          
          // Handle arrays of ObjectIds
          if (Array.isArray(doc[key]) && doc[key].length > 0 && 
              typeof doc[key][0] === 'string' && mongoose.Types.ObjectId.isValid(doc[key][0])) {
            doc[key] = doc[key].map(id => mongoose.Types.ObjectId(id));
          }
        });
        
        // Add audit fields
        if (user) {
          doc.updatedBy = user._id;
          if (!doc.createdBy) {
            doc.createdBy = user._id;
          }
        }
        
        return doc;
      });
      
      // Insert documents
      const insertResult = await Model.insertMany(preparedDocs, { 
        session,
        ordered: false,
        rawResult: true
      });
      
      results.collections.push({
        name: collection,
        restored: insertResult.insertedCount,
        total: documentsToRestore.length
      });
      
      results.totalRestored += insertResult.insertedCount;
    }
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      results
    };
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    throw new Error(`Restore failed: ${error.message}`);
  }
};

/**
 * Get backup file details
 * @param {string} backupFile - Path to backup file
 * @returns {Promise<Object>} - Backup file details
 */
exports.getBackupDetails = async (backupFile) => {
  try {
    const fileContent = await readFile(backupFile, 'utf8');
    const backupData = JSON.parse(fileContent);
    
    if (!backupData.metadata || !backupData.data) {
      throw new Error('Invalid backup file format');
    }
    
    const stats = await promisify(fs.stat)(backupFile);
    
    return {
      filename: path.basename(backupFile),
      path: backupFile,
      size: stats.size,
      created: stats.mtime,
      metadata: backupData.metadata,
      collectionCounts: Object.keys(backupData.data).map(collection => ({
        name: collection,
        count: backupData.data[collection].length
      }))
    };
  } catch (error) {
    throw new Error(`Failed to get backup details: ${error.message}`);
  }
};

/**
 * Delete a backup file
 * @param {string} backupFile - Path to backup file
 * @returns {Promise<Object>} - Result of deletion
 */
exports.deleteBackup = async (backupFile) => {
  try {
    await promisify(fs.unlink)(backupFile);
    
    return {
      success: true,
      filename: path.basename(backupFile),
      path: backupFile,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to delete backup: ${error.message}`);
  }
};
