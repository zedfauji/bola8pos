import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
// Using dynamic import for better compatibility with Vite
import('react-toastify').then(({ toast }) => {
  window.toast = toast; // Make toast available globally
});

const SettingsContext = createContext();

// Utility function to format time elapsed
const formatTimeElapsed = (dateString) => {
  if (!dateString) return 'just now';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

// Default settings if not configured
const DEFAULT_SETTINGS = {
  // Security & Access
  auth: {
    loginMode: 'pin',
    sessionTimeoutMinutes: 30,
    pinPolicy: { minLength: 4, rotateDays: 0, preventReuse: true },
  },
  access: {
    requirePinLifecycle: true,
    requirePinVoidComp: true,
    requirePinRefund: true,
    approvalThresholds: { discountPct: 20, refundAmount: 50, cashPayoutAmount: 50 },
  },
  
  // Taxes & Tips
  taxes: {
    defaultTaxRate: 0.08,
    taxMode: 'exclusive',
  },
  tips: {
    enableTips: true,
    suggestedPercents: [10, 15, 20],
    tipOnPreTax: true,
    allowSplitTender: true,
  },
  
  // Store & Receipt
  store: {
    name: 'BOLA8 POS',
    address: '',
    phone: '',
    taxId: '',
    locale: 'en-US',
    currencyCode: 'USD',
    currencySymbol: '$',
    footer: 'Thank you!',
    receiptWidthMM: 80,
  },
  
  // Printing
  printing: {
    printReceipt: true,
    printKitchen: true,
    printBar: true,
    autoPrint: true,
  },
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  // Dev override can be toggled via localStorage.setItem('pos_dev_allow_all','1')
  const DEV_ALLOW_ALL = (() => { try { return localStorage.getItem('pos_dev_allow_all') === '1'; } catch { return false; } })();

  // Load all settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const [
          authRes, accessRes, 
          taxesRes, tipsRes, 
          storeRes, printingRes
        ] = await Promise.all([
          api.getSetting('auth'),
          api.getSetting('access'),
          api.getSetting('taxes'),
          api.getSetting('tips'),
          api.getSetting('store'),
          api.getSetting('printing'),
        ]);

        setSettings({
          auth: { ...DEFAULT_SETTINGS.auth, ...(authRes?.value || {}) },
          access: { ...DEFAULT_SETTINGS.access, ...(accessRes?.value || {}) },
          taxes: { ...DEFAULT_SETTINGS.taxes, ...(taxesRes?.value || {}) },
          tips: { ...DEFAULT_SETTINGS.tips, ...(tipsRes?.value || {}) },
          store: { ...DEFAULT_SETTINGS.store, ...(storeRes?.value || {}) },
          printing: { ...DEFAULT_SETTINGS.printing, ...(printingRes?.value || {}) },
        });
      } catch (error) {
        console.error('Failed to load settings:', error);
        if (window.toast) {
          window.toast.error('Failed to load settings. Using defaults.');
        } else {
          console.error('Toast not initialized yet');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, []);

  // Update a specific setting section
  const updateSetting = async (section, value) => {
    try {
      await api.setSetting(section, value);
      setSettings(prev => ({
        ...prev,
        [section]: { ...prev[section], ...value }
      }));
      return true;
    } catch (error) {
      console.error(`Failed to update ${section}:`, error);
      if (window.toast) {
        window.toast.error(`Failed to update ${section} settings`);
      } else {
        console.error('Toast not initialized yet');
      }
      return false;
    }
  };

  // Check if PIN is required for an action
  const isPinRequired = (action) => {
    if (DEV_ALLOW_ALL) return false;
    switch (action) {
      case 'void':
      case 'comp':
        return settings.access.requirePinVoidComp;
      case 'refund':
        return settings.access.requirePinRefund;
      // Lifecycle-protected actions
      case 'endSession':
      case 'end': // alias used in TablesPage
      case 'finalize':
      case 'start':
      case 'pause':
      case 'resume':
      case 'clean':
        return settings.access.requirePinLifecycle;
      default:
        return false;
    }
  };

  // Verify a manager PIN via backend
  const verifyPin = async (pin) => {
    try {
      const res = await api.verifyManagerPin(pin);
      // Expecting shape like { ok: true } or { valid: true }
      const ok = (res && (res.ok === true || res.valid === true));
      return ok ? { ok: true } : { ok: false, error: 'Invalid PIN' };
    } catch (e) {
      return { ok: false, error: String(e.message||e) };
    }
  };

  // Check if current user has permission for a specific action
  const hasPermission = (requiredPermission) => {
    if (DEV_ALLOW_ALL) return true; // Temporary: allow all routes/actions
    // Default to true if permissions system isn't fully set up
    if (!settings || !settings.access || !settings.access.roles) return true;
    
    // Get current user role from localStorage or default to 'staff'
    const userRole = localStorage.getItem('userRole') || 'staff';
    const userPermissions = settings.access.roles[userRole] || [];
    
    // Check if user has the required permission or is admin
    return userRole === 'admin' || userPermissions.includes(requiredPermission);
  };

  // Format currency based on store settings
  const formatCurrency = (amount) => {
    try {
      const { locale, currencyCode, currencySymbol } = settings.store;
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'symbol',
      }).format(amount).replace(/\s*[A-Z]{3}/, currencySymbol);
    } catch {
      // Fallback if formatting fails
      return `${settings.store.currencySymbol}${amount.toFixed(2)}`;
    }
  };

  // Calculate tax amount
  const calculateTax = (subtotal, discount = 0) => {
    const { defaultTaxRate, taxMode } = settings.taxes;
    const taxable = Math.max(0, subtotal - discount);
    return taxMode === 'inclusive' 
      ? taxable - (taxable / (1 + defaultTaxRate))
      : taxable * defaultTaxRate;
  };

  return (
    <SettingsContext.Provider 
      value={{
        ...settings,
        isLoading,
        updateSetting,
        isPinRequired,
        verifyPin,
        hasPermission, // Add permission checking function
        formatCurrency,
        calculateTax,
        formatTimeElapsed,
        access: settings.access,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsContext;
