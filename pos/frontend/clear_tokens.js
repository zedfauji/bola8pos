// Script to clear localStorage tokens
console.log('Clearing localStorage tokens...');

// Function to clear tokens from localStorage
function clearTokens() {
  try {
    // Remove access token
    localStorage.removeItem('accessToken');
    console.log('✓ Removed accessToken');
    
    // Remove legacy token if it exists
    localStorage.removeItem('token');
    console.log('✓ Removed legacy token');
    
    // Remove user data
    localStorage.removeItem('user');
    console.log('✓ Removed user data');
    
    console.log('All tokens cleared successfully!');
    console.log('Please refresh the page and log in again.');
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
}

// Execute the function
clearTokens();
