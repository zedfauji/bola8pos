import React from 'react';

export const Input = React.forwardRef(
  /**
   * @param {import('react').InputHTMLAttributes<HTMLInputElement> & { className?: string }} props
   * @param {import('react').Ref<HTMLInputElement>} ref
   */
  function Input({ className = '', ...props }, ref) {
    const base = 'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
    return <input ref={ref} className={`${base} ${className}`} {...props} />;
  }
);

export default Input;
