import { toast } from 'react-toastify';

/**
 * Handles API errors and displays appropriate toast notifications
 * @param {any} error - The error object from axios or other sources
 * @param {string} defaultMessage - Default message to show if error doesn't have a specific message
 * @returns {any} The original error for further handling
 */
export const handleApiError = (error, defaultMessage = 'An error occurred') => {
  // Extract error message from various error formats
  let errorMessage = defaultMessage;
  
  // Handle axios error format
  if (error && typeof error === 'object') {
    if (error.response) {
      // Server responded with an error status code
      const status = error.response.status;
      
      if (status === 404) {
        errorMessage = 'Resource not found. The API endpoint may not be available.';
      } else if (status === 401) {
        errorMessage = 'Unauthorized. Please log in again.';
      } else if (status === 403) {
        errorMessage = 'You do not have permission to access this resource.';
      } else if (status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.response.data && error.response.data.message) {
        // Use server-provided error message if available
        errorMessage = error.response.data.message;
      } else if (error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      }
    } else if (error.request) {
      // Request was made but no response received
      errorMessage = 'No response from server. Please check your connection.';
    } else if (error.message) {
      // Error setting up the request
      errorMessage = error.message;
    }
  }
  
  // Show toast notification
  toast.error(errorMessage, {
    position: "top-right",
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
  
  // Return the original error for further handling
  return error;
};
