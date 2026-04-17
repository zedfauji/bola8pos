/**
 * SHARED LIBRARY EXPORTS
 *
 * Centralized exports for shared utilities, mocks, and test helpers.
 */

// Supabase client and types
export { supabase } from './supabase';
export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from './supabase.types';

// Test utilities
export { renderWithProviders, createTestQueryClient } from './test-utils';
export { render, screen, fireEvent, waitFor, within, cleanup, act } from '@testing-library/react';

// Mock data
export {
  MOCK_IDS,
  scenarios,
  generateMockProduct,
  generateMockCategory,
  generateMockTab,
  generateMockOrder,
  generateMockOrderItem,
  generateMockPoolTable,
  generateMockOccupiedPoolTable,
  generateMockPoolSession,
  generateMockStaff,
  generateMockShift,
  generateMockInventory,
  generateMockPayment,
} from './mocks';
