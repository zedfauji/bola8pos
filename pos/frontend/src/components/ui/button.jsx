import React from 'react';

// Simple mock button component for testing
export const Button = ({ 
  children, 
  variant = 'default',
  size = 'default',
  className = '',
  ...props 
}) => {
  return (
    <button 
      className={`button ${variant} ${size} ${className}`}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
