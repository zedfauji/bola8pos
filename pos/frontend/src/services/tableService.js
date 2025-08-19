import api from './api.js';

const tableService = {
  // Table Layouts
  getTableLayouts: async () => {
    const result = await api.get('/table-layouts');
    return result;
  },

  getActiveTableLayout: async () => {
    const result = await api.get('/table-layouts/active');
    return result;
  },

  getTableLayout: async (/** @type {string} */ id) => {
    const result = await api.get(`/table-layouts/${id}`);
    return result;
  },

  createTableLayout: async (/** @type {Record<string, any>} */ layoutData) => {
    const result = await api.post('/table-layouts', layoutData);
    return result;
  },

  updateTableLayout: async (/** @type {string} */ id, /** @type {Record<string, any>} */ layoutData) => {
    const result = await api.put(`/table-layouts/${id}`, layoutData);
    return result;
  },

  deleteTableLayout: async (/** @type {string} */ id) => {
    await api.delete(`/table-layouts/${id}`);
  },

  // Tables
  getTables: async (/** @type {string} */ layoutId) => {
    const result = await api.get(`/tables?layoutId=${layoutId}`);
    return result;
  },

  getTable: async (/** @type {string} */ id) => {
    const result = await api.get(`/tables/${id}`);
    return result;
  },

  createTable: async (/** @type {Record<string, any>} */ tableData) => {
    const result = await api.post('/tables', tableData);
    return result;
  },

  updateTable: async (/** @type {string} */ id, /** @type {Record<string, any>} */ tableData) => {
    const result = await api.patch(`/tables/${id}`, tableData);
    return result;
  },

  updateTableStatus: async (/** @type {string} */ id, /** @type {string} */ status) => {
    const result = await api.patch(`/tables/${id}/status`, { status });
    return result;
  },

  deleteTable: async (/** @type {string} */ id) => {
    await api.delete(`/tables/${id}`);
  },

  // Table Groups
  getTableGroups: async () => {
    const result = await api.get('/table-groups');
    return result;
  },

  // Table Status History
  getTableStatusHistory: async (/** @type {string} */ tableId, /** @type {Record<string, any>} */ params = {}) => {
    const result = await api.get(`/tables/${tableId}/status-history`, { params });
    return result;
  },

  // Table Analytics
  getTableAnalytics: async (/** @type {Record<string, any>} */ params = {}) => {
    const result = await api.get('/analytics/tables', { params });
    return result;
  },

  // Bulk Operations
  updateTables: async (/** @type {Array<Record<string, any>>} */ updates) => {
    const result = await api.patch('/tables/bulk-update', { updates });
    return result;
  },

  // Import/Export
  exportTables: async (/** @type {string} */ layoutId) => {
    const result = await api.get(`/tables/export?layoutId=${layoutId}`, {
      responseType: 'blob',
    });
    return result;
  },

  importTables: async (/** @type {File|Blob} */ file, /** @type {string} */ layoutId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('layoutId', layoutId);
    
    const result = await api.post('/tables/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return result;
  },
};

export default tableService;
