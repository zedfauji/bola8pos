import { Router } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getDb } from '../config/firebaseNode'
import { INVENTORY } from './inventory'
import { addPoints } from './loyalty'
const r = Router()

type Order = {
  id: string
  items: Array<{ id: string; notes?: string | undefined; qty?: number }>
  createdAt: number
  priority?: boolean
  notes?: string
  table?: string
  memberId?: string
  kitchenStatus: 'pending' | 'in_progress' | 'done'
  accessCode?: string
  comboApplied?: string
  billiardTimeCredit?: number // minutes
  discount?: number
}

type Combo = {
  id: string
  name: string
  items: Array<{ id: string; qty: number }>
  price: number
  discount: number
  billiardTimeCredit?: number // minutes
}

const ORDERS: Order[] = []

// Sample combos
const COMBOS: Combo[] = [
  {
    id: 'combo_1',
    name: 'Burger + Beer + 1hr Billiard',
    items: [
      { id: 'burger', qty: 1 },
      { id: 'beer', qty: 1 }
    ],
    price: 25.00,
    discount: 5.00,
    billiardTimeCredit: 60
  },
  {
    id: 'combo_2',
    name: 'Pizza + Soda + 30min Billiard',
    items: [
      { id: 'pizza', qty: 1 },
      { id: 'soda', qty: 1 }
    ],
    price: 20.00,
    discount: 3.00,
    billiardTimeCredit: 30
  }
]

// Access code validation (simplified for now)
const validateAccessCode = (accessCode: string): boolean => {
  return accessCode.length >= 4 && /^\d+$/.test(accessCode)
}

// Audit logging
const logAction = async (actionType: string, employeeId: string, details: any) => {
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      await db.collection('audit_logs').add({
        actionType,
        employeeId,
        timestamp: Date.now(),
        details,
        ipAddress: 'system',
        cctvTimestamp: Date.now()
      })
    } catch (e) {
      console.error('Failed to log audit:', e)
    }
  }
}

r.get('/', (req, res) => {
  const status = String((req.query as any)?.status || '').toLowerCase()
  let rows = ORDERS
  if (status) {
    if (status === 'delivered' || status === 'done') {
      rows = ORDERS.filter(o => o.kitchenStatus === 'done')
    } else if (status === 'pending') {
      rows = ORDERS.filter(o => o.kitchenStatus === 'pending')
    } else if (status === 'in_progress' || status === 'in-progress') {
      rows = ORDERS.filter(o => o.kitchenStatus === 'in_progress')
    }
  }
  res.json({ orders: rows })
})

// Get available combos
r.get('/combos', (_req, res) => {
  res.json({ combos: COMBOS })
})

r.post('/', async (req, res, next) => {
  const schema = z.object({
    items: z.array(z.object({ 
      id: z.string(), 
      notes: z.string().optional(),
      qty: z.number().int().positive().optional()
    })).min(1),
    priority: z.boolean().optional(),
    notes: z.string().optional(),
    table: z.string().min(1).max(50).optional(),
    memberId: z.string().min(1).max(100).optional(),
    accessCode: z.string().min(4).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return next({ status: 400, code: 'INVALID_BODY', message: 'Invalid order payload', issues: parsed.error.issues })
  const body = parsed.data
  
  // Validate access code if provided
  if (body.accessCode && !validateAccessCode(body.accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = randomUUID()
  const order: Order = {
    id,
    items: body.items.map(({ id, notes, qty }) => ({ 
      id, 
      notes, 
      qty: qty || 1 
    })),
    createdAt: Date.now(),
    kitchenStatus: 'pending',
    ...(body.priority ? { priority: true } : {}),
    ...(body.notes !== undefined ? { notes: body.notes } : {}),
    ...(body.table !== undefined ? { table: body.table } : {}),
    ...(body.memberId ? { memberId: body.memberId } : {}),
    ...(body.accessCode !== undefined ? { accessCode: body.accessCode } : {}),
  }
  ORDERS.push(order)
  
  // Log the order creation
  await logAction('order_created', body.memberId || 'unknown', { 
    orderId: id, 
    table: body.table,
    itemCount: order.items.length,
    accessCode: body.accessCode
  })

  try {
    req.app.get('io')?.emit('order:created', { id, order })
  } catch {}
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      await db.collection('pedidos').doc(id).set(order)
    } catch {}
    }
  return res.json({ ok: true, id, order })
})

// Apply combo to table
r.post('/apply-combo', async (req, res, next) => {
  const schema = z.object({
    table: z.string().min(1),
    comboId: z.string().min(1),
    accessCode: z.string().min(4),
    memberId: z.string().min(1).max(100).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return next({ status: 400, code: 'INVALID_BODY', message: 'Invalid combo payload', issues: parsed.error.issues })
  const { table, comboId, accessCode, memberId } = parsed.data

  // Validate access code
  if (!validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const combo = COMBOS.find(c => c.id === comboId)
  if (!combo) {
    return res.status(404).json({ error: 'Combo not found' })
  }

  // Create order for combo items
  const orderId = randomUUID()
  const order: Order = {
    id: orderId,
    items: combo.items,
    createdAt: Date.now(),
    kitchenStatus: 'pending',
    table,
    ...(memberId ? { memberId } : {}),
    accessCode,
    comboApplied: comboId,
    ...(combo.billiardTimeCredit ? { billiardTimeCredit: combo.billiardTimeCredit } : {}),
    discount: combo.discount
  }
  ORDERS.push(order)

  // Log the combo application
  await logAction('combo_applied', memberId || 'unknown', { 
    orderId, 
    table, 
    comboId,
    comboName: combo.name,
    discount: combo.discount,
    billiardTimeCredit: combo.billiardTimeCredit,
    accessCode
  })

  try {
    req.app.get('io')?.emit('order:created', { id: orderId, order })
  } catch {}

  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      await db.collection('pedidos').doc(orderId).set(order)
    } catch {}
  }

  return res.json({ 
    ok: true, 
    orderId, 
    combo: combo.name,
    discount: combo.discount,
    billiardTimeCredit: combo.billiardTimeCredit
  })
})

r.post('/:id/send-to-kitchen', async (req, res) => {
  const { accessCode } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = req.params.id
  const order = ORDERS.find((o) => o.id === id)
  if (!order) return res.status(404).json({ error: 'Not found' })
  
  if (order.accessCode && order.accessCode !== accessCode) {
    return res.status(401).json({ error: 'Access code mismatch' })
  }

  order.kitchenStatus = 'pending'
  
  // Log the action
  await logAction('order_sent_to_kitchen', order.memberId || 'unknown', { 
    orderId: id, 
    table: order.table,
    accessCode
  })

  return res.json({ ok: true, id, order })
})

r.post('/:id/split', async (req, res) => {
  const { accessCode } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = req.params.id
  const order = ORDERS.find((o) => o.id === id)
  if (!order) return res.status(404).json({ error: 'Not found' })
  
  if (order.accessCode && order.accessCode !== accessCode) {
    return res.status(401).json({ error: 'Access code mismatch' })
  }

  // Log the action
  await logAction('order_split', order.memberId || 'unknown', { 
    orderId: id, 
    table: order.table,
    accessCode
  })

  return res.json({ ok: true, id })
})

// KDS endpoints
r.get('/kds', (_req, res) => {
  const pending = ORDERS.filter((o) => o.kitchenStatus !== 'done').sort(
    (a, b) => Number(Boolean(b.priority)) - Number(Boolean(a.priority)) || a.createdAt - b.createdAt
  )
  res.json({ orders: pending })
})

// Update order status (for KDS)
r.post('/:id/status', async (req, res) => {
  const { status, accessCode } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = req.params.id
  const order = ORDERS.find((o) => o.id === id)
  if (!order) return res.status(404).json({ error: 'Not found' })
  
  if (order.accessCode && order.accessCode !== accessCode) {
    return res.status(401).json({ error: 'Access code mismatch' })
  }

  if (!['pending', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  order.kitchenStatus = status as Order['kitchenStatus']
  
  // Log the status change
  await logAction('order_status_changed', order.memberId || 'unknown', { 
    orderId: id, 
    table: order.table,
    oldStatus: order.kitchenStatus,
    newStatus: status,
    accessCode
  })

  try {
    req.app.get('io')?.emit('order:status_changed', { id, status })
  } catch {}
  
  return res.json({ ok: true, id, order })
})

r.post('/:id/complete', async (req, res) => {
  const { accessCode } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = req.params.id
  const order = ORDERS.find((o) => o.id === id)
  if (!order) return res.status(404).json({ error: 'Not found' })
  
  if (order.accessCode && order.accessCode !== accessCode) {
    return res.status(401).json({ error: 'Access code mismatch' })
  }

  order.kitchenStatus = 'done'
  
  // Log the completion
  await logAction('order_completed', order.memberId || 'unknown', { 
    orderId: id, 
    table: order.table,
    accessCode
  })

  try {
    req.app.get('io')?.emit('order:completed', { id })
  } catch {}
  // decrement inventory on completion (sale realized)
  try {
    for (const it of order.items) {
      const inv = INVENTORY.find((x) => x.sku === it.id)
      if (inv && inv.qty > 0) inv.qty -= (it.qty || 1)
    }
  } catch {}
  // simple loyalty: +1 point per item if explicit memberId present or table matches pattern
  try {
    const explicit = order.memberId
    const inferred = String(order.table || '').match(/^M:(.+)$/)?.[1]
    const member = explicit || inferred
    if (member) addPoints(member, order.items.reduce((sum, item) => sum + (item.qty || 1), 0))
  } catch {}
  res.json({ ok: true, id })
})

// Recall an order back to pending
r.post('/:id/recall', async (req, res) => {
  const { accessCode } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = req.params.id
  const order = ORDERS.find((o) => o.id === id)
  if (!order) return res.status(404).json({ error: 'Not found' })
  
  if (order.accessCode && order.accessCode !== accessCode) {
    return res.status(401).json({ error: 'Access code mismatch' })
  }

  order.kitchenStatus = 'pending'
  
  // Log the recall
  await logAction('order_recalled', order.memberId || 'unknown', { 
    orderId: id, 
    table: order.table,
    accessCode
  })

  try {
    req.app.get('io')?.emit('order:recalled', { id })
  } catch {}
  return res.json({ ok: true, id })
})

// Complete all open orders for a table (no inventory or loyalty side-effects)
r.post('/complete-by-table', async (req, res, next) => {
  const schema = z.object({ 
    table: z.string().min(1),
    accessCode: z.string().min(4)
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return next({ status: 400, code: 'INVALID_BODY', message: 'Invalid payload', issues: parsed.error.issues })
  const { table, accessCode } = parsed.data
  
  // Validate access code
  if (!validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  let completed = 0
  for (const o of ORDERS) {
    if (o.table === table && o.kitchenStatus !== 'done') {
      o.kitchenStatus = 'done'
      completed += 1
      try { req.app.get('io')?.emit('order:completed', { id: o.id }) } catch {}
    }
  }
  
  // Log the bulk completion
  await logAction('orders_bulk_completed', 'unknown', { 
    table, 
    completed,
    accessCode
  })

  return res.json({ ok: true, completed })
})

// List open items by table (aggregated by item id)
r.get('/by-table/:table', (req, res) => {
  const table = req.params.table
  const open = ORDERS.filter((o) => o.table === table && o.kitchenStatus !== 'done')
  const qtyMap: Record<string, number> = Object.create(null)
  for (const o of open) {
    for (const it of o.items) {
      qtyMap[it.id] = (qtyMap[it.id] || 0) + (it.qty || 1)
    }
  }
  const items = Object.entries(qtyMap).map(([id, qty]) => {
    const inv = INVENTORY.find((x) => x.sku === id)
    return { id, qty, price: inv?.price ?? 0, name: inv?.name ?? id }
  })
  return res.json({ table, items, countOrders: open.length })
})

// Direct pay (no KDS): decrement inventory for provided items
r.post('/pay', async (req, res, next) => {
  const schema = z.object({
    items: z.array(
      z.object({
        id: z.string(),
        qty: z.number().int().positive().optional(),
      })
    ).min(1),
    memberId: z.string().min(1).max(100).optional(),
    table: z.string().max(100).optional(),
    accessCode: z.string().min(4).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return next({ status: 400, code: 'INVALID_BODY', message: 'Invalid pay payload', issues: parsed.error.issues })
  const { items, memberId, table, accessCode } = parsed.data
  
  // Validate access code if provided
  if (accessCode && !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  try {
    for (const it of items) {
      const qty = Math.max(1, it.qty ?? 1)
      const inv = INVENTORY.find((x) => x.sku === it.id)
      if (inv) inv.qty = Math.max(0, inv.qty - qty)
    }
  } catch {}
  try {
    const inferred = String(table || '').match(/^M:(.+)$/)?.[1]
    const member = memberId || inferred
    if (member) addPoints(member, items.reduce((s, it) => s + Math.max(1, it.qty ?? 1), 0))
  } catch {}
  
  // Log the payment
  await logAction('direct_payment', memberId || 'unknown', { 
    table, 
    items: items.map(item => ({ id: item.id, qty: item.qty || 1 })),
    accessCode
  })

  return res.json({ ok: true })
})

export default r