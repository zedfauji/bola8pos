/**
 * Inventory Alerts Utility
 * Provides functions to trigger inventory alerts from controllers
 */

let inventoryAlertService = null;

/**
 * Initialize the inventory alert utility with the alert service
 * @param {Object} alertService - The inventory alert service instance
 */
exports.initializeAlerts = (alertService) => {
  inventoryAlertService = alertService;
};

/**
 * Check if a product is low in stock and trigger an alert if needed
 * @param {String} productId - The product ID to check
 * @param {String} locationId - Optional location ID to check
 */
exports.checkAndTriggerProductAlert = async (productId, locationId = null) => {
  if (!inventoryAlertService) return;
  
  try {
    const isLow = await inventoryAlertService.isProductLowInStock(productId, locationId);
    
    if (isLow) {
      await inventoryAlertService.sendProductAlert(productId, locationId);
    }
  } catch (error) {
    console.error('Error triggering product alert:', error);
  }
};

/**
 * Trigger a full inventory check for low stock items
 * @param {Object} options - Options for the check
 */
exports.triggerLowStockCheck = async (options = {}) => {
  if (!inventoryAlertService) return;
  
  try {
    await inventoryAlertService.checkLowStockItems(options);
  } catch (error) {
    console.error('Error triggering low stock check:', error);
  }
};

/**
 * Get the inventory alert service instance
 * @returns {Object} The inventory alert service
 */
exports.getAlertService = () => {
  return inventoryAlertService;
};
