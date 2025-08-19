import apiClient from '../lib/apiClient';

// Access code helpers
function normalizeEndpoint(endpoint = '') {
  let ep = String(endpoint || '');
  
  // Replace HTTPS with HTTP for localhost URLs to avoid SSL errors
  if (/^https:\/\/localhost/i.test(ep)) {
    ep = ep.replace(/^https:/i, 'http:');
    console.log('Converted HTTPS to HTTP for localhost URL:', ep);
  }
  
  if (/^https?:\/\//i.test(ep)) return ep; // absolute URL
  if (ep.startsWith('/api')) return ep.substring(4); // Remove /api prefix since apiClient already has it
  return ep.startsWith('/') ? ep : `/${ep}`;
}

// Access code helpers
function getAccessCode() {
  try {
    const v = localStorage.getItem('pos_access_code');
    if (v && v.trim().length >= 4) return v.trim();
  } catch {}
  // default
  try { localStorage.setItem('pos_access_code', '1234'); } catch {}
  return '1234';
}

export function setAccessCode(code) {
  try { localStorage.setItem('pos_access_code', String(code || '').trim()); } catch {}
}

class ApiService {
  async request(endpoint, options = {}) {
    const { responseType } = options || {};
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    
    // Convert fetch-style options to axios-style config
    const method = options.method || 'GET';
    const headers = options.headers || {};
    
    // Automatically include accessCode in JSON body for mutating requests
    let data = null;
    if (options.body) {
      try {
        const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
        const isJson = String(headers['Content-Type'] || '').includes('application/json');
        
        if (mutating && isJson && typeof options.body === 'string') {
          const parsed = JSON.parse(options.body);
          if (parsed && typeof parsed === 'object' && parsed.accessCode === undefined) {
            const code = getAccessCode();
            parsed.accessCode = code;
            data = parsed;
          } else {
            data = parsed;
          }
        } else if (options.body instanceof FormData) {
          data = options.body;
        } else {
          data = options.body;
        }
      } catch (e) {
        console.warn('Could not process request body:', e);
        data = options.body;
      }
    } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      // Empty body for mutating requests should include accessCode
      data = { accessCode: getAccessCode() };
    }
    
    // Create axios config
    const config = {
      method,
      headers,
      ...(responseType ? { responseType } : {}),
      withCredentials: true, // Include cookies with all requests
    };
    
    // Add data to request if present
    if (data !== null) {
      config.data = data;
    }
    
    try {
      const response = await apiClient(normalizedEndpoint, config);
      return response.data;
    } catch (error) {
      console.error('API request failed:', error);
      
      // Format error similar to the original implementation
      const err = new Error(`HTTP error ${error.response?.status || 'unknown'}: ${error.message}`);
      if (error.response) {
        err.status = error.response.status;
        err.detail = error.response.data ? JSON.stringify(error.response.data) : '';
      }
      throw err;
    }
  }

  // Generic helpers used by various modules (TableContext, tableService)
  async get(endpoint, { params, headers, responseType } = {}) {
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    return apiClient.get(normalizedEndpoint, { params, headers, responseType })
      .then(response => response.data)
      .catch(error => {
        console.error('API GET request failed:', error);
        throw error;
      });
  }

  async delete(endpoint, { params, headers } = {}) {
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    return apiClient.delete(normalizedEndpoint, { params, headers })
      .then(response => response.data)
      .catch(error => {
        console.error('API DELETE request failed:', error);
        throw error;
      });
  }

  async post(endpoint, data, { headers, responseType } = {}) {
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    const isForm = typeof FormData !== 'undefined' && data instanceof FormData;
    const hdrs = isForm ? { ...(headers || {}) } : { 'Content-Type': 'application/json', ...(headers || {}) };
    
    // Add accessCode to data if it's not a FormData and doesn't already have it
    let processedData = data;
    if (!isForm && data && typeof data === 'object' && data.accessCode === undefined) {
      processedData = { ...data, accessCode: getAccessCode() };
    } else if (!data && !isForm) {
      processedData = { accessCode: getAccessCode() };
    }
    
    return apiClient.post(normalizedEndpoint, processedData, { headers: hdrs, responseType })
      .then(response => response.data)
      .catch(error => {
        console.error('API POST request failed:', error);
        throw error;
      });
  }

  async put(endpoint, data, { headers } = {}) {
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    const isForm = typeof FormData !== 'undefined' && data instanceof FormData;
    const hdrs = isForm ? { ...(headers || {}) } : { 'Content-Type': 'application/json', ...(headers || {}) };
    
    // Add accessCode to data if it's not a FormData and doesn't already have it
    let processedData = data;
    if (!isForm && data && typeof data === 'object' && data.accessCode === undefined) {
      processedData = { ...data, accessCode: getAccessCode() };
    } else if (!data && !isForm) {
      processedData = { accessCode: getAccessCode() };
    }
    
    return apiClient.put(normalizedEndpoint, processedData, { headers: hdrs })
      .then(response => response.data)
      .catch(error => {
        console.error('API PUT request failed:', error);
        throw error;
      });
  }

  async patch(endpoint, data, { headers } = {}) {
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    const isForm = typeof FormData !== 'undefined' && data instanceof FormData;
    const hdrs = isForm ? { ...(headers || {}) } : { 'Content-Type': 'application/json', ...(headers || {}) };
    
    // Add accessCode to data if it's not a FormData and doesn't already have it
    let processedData = data;
    if (!isForm && data && typeof data === 'object' && data.accessCode === undefined) {
      processedData = { ...data, accessCode: getAccessCode() };
    } else if (!data && !isForm) {
      processedData = { accessCode: getAccessCode() };
    }
    
    return apiClient.patch(normalizedEndpoint, processedData, { headers: hdrs })
      .then(response => response.data)
      .catch(error => {
        console.error('API PATCH request failed:', error);
        throw error;
      });
  }

  // Tables API
  async getTables() {
    return this.request('/api/tables');
  }

  async updateTable(id, data) {
    return this.request(`/api/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async migrateTable(id, destTableId, partialTime = false) {
    return this.request(`/api/tables/${id}/migrate`, {
      method: 'POST',
      body: JSON.stringify({ toTableId: destTableId, partialTime }),
    });
  }

  // Moves API (events for merge/split/etc.)
  async moveEvent(payload) {
    return this.request('/api/moves/move', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Orders aggregation by table
  async getOpenItemsByTable(table) {
    return this.request(`/api/orders/by-table/${encodeURIComponent(table)}`);
  }

  async completeOrdersByTable(table) {
    return this.request('/api/orders/complete-by-table', {
      method: 'POST',
      body: JSON.stringify({ table }),
    });
  }

  async payDirect(items, table = null, memberId = null) {
    return this.request('/api/orders/pay', {
      method: 'POST',
      body: JSON.stringify({ items, ...(table ? { table } : {}), ...(memberId ? { memberId } : {}) }),
    });
  }

  async stopTable(numericId) {
    return this.request(`/api/tables/${numericId}/stop`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Menu API
  async getMenuItems(category = null) {
    const query = category ? `?category=${category}` : '';
    return this.request(`/api/menu${query}`);
  }

  // Orders API
  async getOrders(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    const endpoint = query ? `/api/orders?${query}` : '/api/orders';
    return this.request(endpoint);
  }

  async createOrder(orderData) {
    return this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async updateOrder(id, data) {
    return this.request(`/api/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // KDS API
  async getKDSOrders() {
    return this.request('/api/orders/kds');
  }

  async updateOrderStatus(id, status) {
    const newStatus = typeof status === 'string' ? status : (status && status.status) || status;
    // Backend expects POST /api/orders/:id/status with { status }
    return this.request(`/api/orders/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async recallOrder(id) {
    return this.request(`/api/orders/${id}/recall`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Bills API
  async createBill(billData) {
    return this.request('/api/bills', {
      method: 'POST',
      body: JSON.stringify(billData),
    });
  }

  async getPendingBills() {
    return this.request('/api/bills/pending');
  }

  async payByTable({ table_id, payment_method = 'cash', tip = 0, discount_total = 0, tender_cash = 0, tender_card = 0, member_id = null }) {
    return this.request('/api/bills/pay-by-table', {
      method: 'POST',
      body: JSON.stringify({ table_id, payment_method, tip, discount_total, tender_cash, tender_card, ...(member_id ? { member_id } : {}) }),
    });
  }

  // Discounts
  async getDiscounts() {
    return this.request('/api/discounts');
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Admin / Manager approvals
  async verifyManagerPin(pin) {
    return this.request('/api/admin/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  }

  async voidOrderLine({ tableId, line, reason, managerPin }) {
    return this.request('/api/orders/void-line', {
      method: 'POST',
      body: JSON.stringify({ tableId, line, reason, managerPin }),
    });
  }

  async compOrderLine({ tableId, line, reason, managerPin }) {
    return this.request('/api/orders/comp-line', {
      method: 'POST',
      body: JSON.stringify({ tableId, line, reason, managerPin }),
    });
  }

  async getAuditLogs(limit = 100) {
    return this.request(`/api/admin/audit?limit=${encodeURIComponent(limit)}`);
  }

  // Tables
  async createTable(table) {
    return this.request('/api/tables', {
      method: 'POST',
      body: JSON.stringify(table),
    });
  }

  async finalizeTableBill(id, { reason, managerPin }) {
    return this.request(`/api/tables/${encodeURIComponent(id)}/finalize-bill`, {
      method: 'POST',
      body: JSON.stringify({ reason, managerPin }),
    });
  }

  async endTableSession(id, { reason, managerPin }) {
    return this.request(`/api/tables/${encodeURIComponent(id)}/end-session`, {
      method: 'POST',
      body: JSON.stringify({ reason, managerPin }),
    });
  }

  // Table lifecycle
  async startTable(id, { rate = 0, limited = false, minutes = 0, services = 0 } = {}) {
    return this.request(`/api/tables/${encodeURIComponent(id)}/start`, {
      method: 'POST',
      body: JSON.stringify({ rate, limited, minutes, services }),
    });
  }

  async pauseTable(id) {
    return this.request(`/api/tables/${encodeURIComponent(id)}/pause`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async resumeTable(id) {
    return this.request(`/api/tables/${encodeURIComponent(id)}/resume`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async setCleaning(id, minutes = 5) {
    return this.request(`/api/tables/${encodeURIComponent(id)}/cleaning`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    });
  }

  // Reports
  async getReportShift({ from, to } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', String(from));
    if (to) params.set('to', String(to));
    const q = params.toString();
    return this.request(`/api/reports/shift${q ? `?${q}` : ''}`);
  }

  async getReportToday() {
    return this.request('/api/reports/today');
  }

  // -------- Shifts / Cash Reconciliation --------
  async getActiveShift() {
    return this.request('/api/shifts/active');
  }

  async openShift({ start_cash = 0, terminal_id = null, notes = '', user_id = 'cashier' } = {}) {
    return this.request('/api/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ start_cash, terminal_id, notes, user_id }),
    });
  }

  async addShiftMovement(shift_id, { type, amount, reason = '', user_id = 'cashier' }) {
    return this.request(`/api/shifts/${encodeURIComponent(shift_id)}/movement`, {
      method: 'POST',
      body: JSON.stringify({ type, amount, reason, user_id }),
    });
  }

  async closeShift(shift_id, { end_cash_counted, notes = '', user_id = 'cashier' }) {
    return this.request(`/api/shifts/${encodeURIComponent(shift_id)}/close`, {
      method: 'POST',
      body: JSON.stringify({ end_cash_counted, notes, user_id }),
    });
  }

  async getShiftSummary(shift_id) {
    return this.request(`/api/shifts/${encodeURIComponent(shift_id)}/summary`);
  }

  async getShiftHistory({ limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    const q = params.toString();
    return this.request(`/api/shifts/history${q ? `?${q}` : ''}`);
  }

  // Admin Settings (key-value JSON)
  async getSetting(key) {
    return this.request(`/api/settings/${encodeURIComponent(key)}`);
  }

  async setSetting(key, value) {
    return this.request(`/api/settings/${encodeURIComponent(key)}` , {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  // Printer Groups
  async getPrinterGroups() {
    return this.request('/api/printer-groups');
  }
  async createPrinterGroup(data) {
    return this.request('/api/printer-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updatePrinterGroup(id, data) {
    return this.request(`/api/printer-groups/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async deletePrinterGroup(id) {
    return this.request(`/api/printer-groups/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // Printers
  async getPrinters() {
    return this.request('/api/printers');
  }
  async createPrinter(data) {
    return this.request('/api/printers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updatePrinter(id, data) {
    return this.request(`/api/printers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async deletePrinter(id) {
    return this.request(`/api/printers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // Print Routes
  async getPrintRoutes() {
    return this.request('/api/print-routes');
  }
  async createPrintRoute(data) {
    return this.request('/api/print-routes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updatePrintRoute(id, data) {
    return this.request(`/api/print-routes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async deletePrintRoute(id) {
    return this.request(`/api/print-routes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // Reports
  async getReportShift({ from, to } = {}) {
    // Convert timestamps to ISO strings if they're numbers
    const fromStr = from ? new Date(Number(from)).toISOString() : '';
    const toStr = to ? new Date(Number(to)).toISOString() : '';
    
    // Build query string with proper encoding
    const params = new URLSearchParams();
    if (fromStr) params.append('from', fromStr);
    if (toStr) params.append('to', toStr);
    
    const query = params.toString();
    return this.request(`/api/reports/shift${query ? `?${query}` : ''}`);
  }
  
  async getReportToday() {
    return this.request('/api/reports/today');
  }
}

export default new ApiService();
