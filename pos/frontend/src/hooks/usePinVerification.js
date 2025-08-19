import { useState, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook for PIN verification functionality
 * 
 * @returns {Object} PIN verification methods and state
 */
const usePinVerification = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  /**
   * Verify PIN with the server
   * 
   * @param {string} pin - PIN to verify
   * @returns {Promise<boolean>} Whether verification was successful
   */
  const verifyPin = useCallback(async (pin) => {
    setIsVerifying(true);
    
    try {
      const response = await api.post('/auth/verify-pin', { pin });
      
      if (response.data.success) {
        setIsModalOpen(false);
        
        // Execute the pending action if it exists
        if (pendingAction && typeof pendingAction === 'function') {
          await pendingAction(pin);
          setPendingAction(null);
        }
        
        return true;
      } else {
        throw new Error(response.data.message || 'PIN verification failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'PIN verification failed';
      throw new Error(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  }, [pendingAction]);

  /**
   * Request PIN verification before executing an action
   * 
   * @param {Function} action - Action to execute after PIN verification
   * @returns {Promise<void>}
   */
  const requirePin = useCallback((action) => {
    setPendingAction(() => action);
    setIsModalOpen(true);
    
    // Return a promise that resolves when the modal is closed
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!isModalOpen) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }, [isModalOpen]);

  /**
   * Close the PIN verification modal
   */
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setPendingAction(null);
  }, []);

  return {
    isModalOpen,
    isVerifying,
    verifyPin,
    requirePin,
    closeModal
  };
};

export default usePinVerification;
