import { Router } from 'express'
import { getDb } from '../config/firebaseNode'
const r = Router()

type OrderStatus = 'pending' | 'in_progress' | 'done'
type Order = {
  id: string
  items: Array<{ id: string; notes?: string; qty?: number; name?: string }>
  createdAt: number
  priority?: boolean
  notes?: string
  table?: string
  memberId?: string
  kitchenStatus: OrderStatus
  accessCode?: string
  comboApplied?: string
  billiardTimeCredit?: number
  discount?: number
}

// Access code validation
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

// Get all orders for KDS display
r.get('/', async (req, res) => {
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const snap = await db.collection('pedidos').get()
      const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      
      // Sort by priority and creation time
      const sortedOrders = orders
        .filter((o: Order) => o.kitchenStatus !== 'done')
        .sort((a: Order, b: Order) => 
          Number(Boolean(b.priority)) - Number(Boolean(a.priority)) || 
          a.createdAt - b.createdAt
        )
      
      return res.json({ orders: sortedOrders })
    } catch (e) {
      return res.json({ orders: [], error: 'Failed to fetch from Firestore' })
    }
  }
  
  // Fallback to memory (empty for now)
  res.json({ orders: [] })
})

// Get orders by status
r.get('/status/:status', async (req, res) => {
  const status = req.params.status as OrderStatus
  
  if (!['pending', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const snap = await db.collection('pedidos').where('kitchenStatus', '==', status).get()
      const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      
      // Sort by priority and creation time
      const sortedOrders = orders.sort((a: Order, b: Order) => 
        Number(Boolean(b.priority)) - Number(Boolean(a.priority)) || 
        a.createdAt - b.createdAt
      )
      
      return res.json({ orders: sortedOrders, status })
    } catch (e) {
      return res.json({ orders: [], error: 'Failed to fetch from Firestore' })
    }
  }
  
  res.json({ orders: [], status })
})

// Update order status (for kitchen staff)
r.post('/:id/status', async (req, res) => {
  const { status, accessCode, employeeId } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  if (!['pending', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  const id = req.params.id
  
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const orderRef = db.collection('pedidos').doc(id)
      const orderDoc = await orderRef.get()
      
      if (!orderDoc.exists) {
        return res.status(404).json({ error: 'Order not found' })
      }

      const order = orderDoc.data() as Order
      
      // Update status
      await orderRef.update({ kitchenStatus: status })
      
      // Log the status change
      await logAction('kds_status_changed', employeeId || 'unknown', { 
        orderId: id, 
        table: order.table,
        oldStatus: order.kitchenStatus,
        newStatus: status,
        accessCode
      })

      // Emit socket event if available
      try {
        const io = req.app.get('io')
        if (io) {
          io.emit('order:status_changed', { id, status })
        }
      } catch {}

      return res.json({ ok: true, id, status })
    } catch (e) {
      return res.status(500).json({ error: 'Failed to update order status' })
    }
  }
  
  res.status(500).json({ error: 'Firestore not enabled' })
})

// Mark order as in progress
r.post('/:id/start', async (req, res) => {
  const { accessCode, employeeId } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = req.params.id
  
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const orderRef = db.collection('pedidos').doc(id)
      const orderDoc = await orderRef.get()
      
      if (!orderDoc.exists) {
        return res.status(404).json({ error: 'Order not found' })
      }

      const order = orderDoc.data() as Order
      
      // Update status to in_progress
      await orderRef.update({ kitchenStatus: 'in_progress' })
      
      // Log the action
      await logAction('kds_order_started', employeeId || 'unknown', { 
        orderId: id, 
        table: order.table,
        accessCode
      })

      // Emit socket event
      try {
        const io = req.app.get('io')
        if (io) {
          io.emit('order:status_changed', { id, status: 'in_progress' })
        }
      } catch {}

      return res.json({ ok: true, id, status: 'in_progress' })
    } catch (e) {
      return res.status(500).json({ error: 'Failed to start order' })
    }
  }
  
  res.status(500).json({ error: 'Firestore not enabled' })
})

// Mark order as completed
r.post('/:id/complete', async (req, res) => {
  const { accessCode, employeeId } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = req.params.id
  
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const orderRef = db.collection('pedidos').doc(id)
      const orderDoc = await orderRef.get()
      
      if (!orderDoc.exists) {
        return res.status(404).json({ error: 'Order not found' })
      }

      const order = orderDoc.data() as Order
      
      // Update status to done
      await orderRef.update({ kitchenStatus: 'done' })
      
      // Log the completion
      await logAction('kds_order_completed', employeeId || 'unknown', { 
        orderId: id, 
        table: order.table,
        accessCode
      })

      // Emit socket event
      try {
        const io = req.app.get('io')
        if (io) {
          io.emit('order:completed', { id })
        }
      } catch {}

      return res.json({ ok: true, id, status: 'done' })
    } catch (e) {
      return res.status(500).json({ error: 'Failed to complete order' })
    }
  }
  
  res.status(500).json({ error: 'Firestore not enabled' })
})

// Get order details
r.get('/:id', async (req, res) => {
  const id = req.params.id
  
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const orderDoc = await db.collection('pedidos').doc(id).get()
      
      if (!orderDoc.exists) {
        return res.status(404).json({ error: 'Order not found' })
      }

      const order = { id: orderDoc.id, ...orderDoc.data() }
      return res.json({ order })
    } catch (e) {
      return res.status(500).json({ error: 'Failed to fetch order' })
    }
  }
  
  res.status(500).json({ error: 'Firestore not enabled' })
})

// Get orders by table
r.get('/table/:table', async (req, res) => {
  const table = req.params.table
  
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const snap = await db.collection('pedidos').where('table', '==', table).get()
      const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      
      // Sort by creation time
      const sortedOrders = orders.sort((a: Order, b: Order) => a.createdAt - b.createdAt)
      
      return res.json({ orders: sortedOrders, table })
    } catch (e) {
      return res.json({ orders: [], error: 'Failed to fetch from Firestore' })
    }
  }
  
  res.json({ orders: [], table })
})

export default r

