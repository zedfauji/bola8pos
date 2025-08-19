import React from 'react';

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange?.(false)}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function DialogContent({ className = '', children }) {
  return (
    <div className={`bg-white text-gray-900 rounded-md shadow-lg p-4 w-[480px] max-w-[90vw] ${className}`}>
      {children}
    </div>
  );
}

export function DialogHeader({ className = '', children }) {
  return <div className={`mb-2 ${className}`}>{children}</div>;
}

export function DialogTitle({ className = '', children }) {
  return <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>;
}

// Missing in previous implementation: provide a description block for dialogs
export function DialogDescription({ className = '', children }) {
  return <p className={`text-sm text-gray-600 ${className}`}>{children}</p>;
}

export function DialogFooter({ className = '', children }) {
  return <div className={`mt-4 flex justify-end gap-2 ${className}`}>{children}</div>;
}

export default Dialog;
