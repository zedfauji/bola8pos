const RAW_API_URL = import.meta.env.VITE_API_URL
export const API_URL = String(RAW_API_URL || '').replace(/\/api\/?$/, '')

type ResponseType = 'json' | 'blob' | 'text'

async function request(path: string, init?: RequestInit & { responseType?: ResponseType }) {
  if (!API_URL) throw new Error('VITE_API_URL is not set')
  const { responseType } = init || {}
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (responseType === 'blob') return res.blob()
  if (responseType === 'text') return res.text()
  return res.json()
}

export const api = {
  // Tables
  listTables: () => request('/api/tables'),
  startTable: (id: number) => request(`/api/tables/${id}/start`, { method: 'POST' }),
  stopTable: (id: number) => request(`/api/tables/${id}/stop`, { method: 'POST' }),

  // Orders
  listOrders: () => request('/api/orders'),
  createOrder: (payload: any) => request('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
  sendToKitchen: (id: string) => request(`/api/orders/${id}/send-to-kitchen`, { method: 'POST' }),
  pay: (items: Array<{ id: string; qty?: number }>) => request('/api/orders/pay', { method: 'POST', body: JSON.stringify({ items }) }),

  // Loyalty
  getPoints: (id: string) => request(`/api/loyalty/${id}`),
  accrue: (customerId: string, points: number) => request('/api/loyalty/accrue', { method: 'POST', body: JSON.stringify({ customerId, points }) }),
  redeem: (customerId: string, points: number) => request('/api/loyalty/redeem', { method: 'POST', body: JSON.stringify({ customerId, points }) }),

  // Moves
  move: (payload: { sourceTableId: number; destTableId: number; scope: 'all' | 'items'; itemIds?: string[]; idempotencyKey?: string }) =>
    request('/api/moves/move', { method: 'POST', body: JSON.stringify(payload) }),

  // Table items (for UI selection)
  listTableItems: (tableId: number) => request(`/api/tables/${tableId}/items`),

  // Inventory movements
  recordMovement: (payload: { sku: string; type: 'purchase' | 'sale' | 'adjustment' | 'waste'; qty: number }) =>
    request('/api/inventory/movement', { method: 'POST', body: JSON.stringify(payload) }),
}

// Provide a default export compatible with default import usage elsewhere.
// We purposely keep it as any to avoid forcing strict typing mismatches with the JS implementation.
// Consumers that want typed helpers can import named exports from this module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const http = api as any
export default http

