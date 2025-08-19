import React, { useState, useEffect, useRef } from 'react';
import { LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * PIN Verification Modal for sensitive operations
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to call when modal is closed
 * @param {Function} props.onVerify - Function to call when PIN is verified
 * @param {string} props.title - Modal title
 * @param {string} props.description - Modal description
 * @returns {React.ReactElement} PIN verification modal
 */
const PinVerificationModal = ({
  isOpen,
  onClose,
  onVerify,
  title = 'PIN Verification Required',
  description = 'Please enter your PIN to continue with this operation.',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pinInputRef = useRef(null);

  // Focus the PIN input when the modal opens
  useEffect(() => {
    if (isOpen && pinInputRef.current) {
      setTimeout(() => {
        pinInputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!pin) {
      setError('PIN is required');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onVerify(pin);
      // If verification is successful, onVerify will close the modal
    } catch (err) {
      setError(err.message || 'PIN verification failed');
      setLoading(false);
    }
  };

  // Handle PIN input change
  const handlePinChange = (e) => {
    const value = e.target.value;
    // Only allow digits
    if (/^\d*$/.test(value) && value.length <= 6) {
      setPin(value);
      setError('');
    }
  };

  // Handle escape key press
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-indigo-600">
          <div className="flex items-center">
            <LockClosedIcon className="h-6 w-6 text-white mr-2" />
            <h2 className="text-xl font-semibold text-white">{title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200 focus:outline-none"
            aria-label="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-gray-600 mb-4">{description}</p>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-1">
                PIN Code
              </label>
              <input
                ref={pinInputRef}
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter PIN"
                value={pin}
                onChange={handlePinChange}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="mb-4 p-2 text-sm text-red-700 bg-red-100 rounded-md">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PinVerificationModal;
