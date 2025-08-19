import { Router } from 'express'
import { getDb } from '../config/firebaseNode'
const r = Router()

type TableStatus = 'free' | 'occupied' | 'reserved'
type TableType = 'Billiard' | 'Normal' | 'La Barra'
type Table = { 
  id: number; 
  name: string; 
  tableType: TableType;
  status: TableStatus; 
  startedAt: number | null; 
  freeUntil: number | null; 
  cueRented: boolean;
  customerId?: string;
  accessCode?: string;
  rentalTime?: number; // in minutes
  lightOn?: boolean; // for billiard tables
  currentSessionId?: string;
}

const TABLES: Table[] = [
  // Billiard tables (4x4 grid layout)
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: i + 1,
    name: `Billiard ${i + 1}`,
    tableType: 'Billiard' as TableType,
    status: 'free' as TableStatus,
    startedAt: null,
    freeUntil: null,
    cueRented: false,
    lightOn: false,
  })),
  // Normal tables
  ...Array.from({ length: 4 }).map((_, i) => ({
    id: i + 9,
    name: `Normal ${i + 1}`,
    tableType: 'Normal' as TableType,
    status: 'free' as TableStatus,
    startedAt: null,
    freeUntil: null,
    cueRented: false,
  })),
  // La Barra tables
  ...Array.from({ length: 4 }).map((_, i) => ({
    id: i + 13,
    name: `La Barra ${String.fromCharCode(65 + i)}`,
    tableType: 'La Barra' as TableType,
    status: 'free' as TableStatus,
    startedAt: null,
    freeUntil: null,
    cueRented: false,
  }))
]

// Access code validation (simplified for now)
const validateAccessCode = (accessCode: string): boolean => {
  // In production, this would validate against a database
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

r.get('/', async (_req, res) => {
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const snap = await db.collection('mesas').get()
      const tables = snap.docs.map((d) => ({ id: Number(d.id), ...(d.data() as any) }))
      return res.json({ tables })
    } catch (e) {
      // fallback to memory
    }
  }
  res.json({ tables: TABLES })
})

// Get tables by type
r.get('/type/:tableType', (req, res) => {
  const tableType = req.params.tableType as TableType
  const filteredTables = TABLES.filter(t => t.tableType === tableType)
  res.json({ tables: filteredTables, tableType })
})

// Start table with access code validation
r.post('/:id/start', async (req, res) => {
  const { accessCode, customerId } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = Number(req.params.id)
  const t = TABLES.find((t) => t.id === id)
  if (!t) return res.status(404).json({ error: 'Not found' })
  
  if (t.status !== 'free') {
    return res.status(400).json({ error: 'Table is not available' })
  }

  const now = Date.now()
  t.status = 'occupied'
  t.startedAt = now
  t.freeUntil = now + 60 * 60 * 1000 // 1 hour default
  t.customerId = customerId
  t.accessCode = accessCode
  t.rentalTime = 0

  // For billiard tables, turn on lights
  if (t.tableType === 'Billiard') {
    t.lightOn = true
  }

  // Log the action
  await logAction('table_start', customerId || 'unknown', { tableId: id, tableType: t.tableType })

  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      await db.collection('mesas').doc(String(id)).set(t, { merge: true })
    } catch {}
  }
  return res.json({ ok: true, table: t })
})

// Stop table
r.post('/:id/stop', async (req, res) => {
  const { accessCode } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = Number(req.params.id)
  const t = TABLES.find((t) => t.id === id)
  if (!t) return res.status(404).json({ error: 'Not found' })
  
  if (t.accessCode !== accessCode) {
    return res.status(401).json({ error: 'Access code mismatch' })
  }

  // Calculate rental time
  let rentalTime = 0
  if (t.startedAt) {
    rentalTime = Math.ceil((Date.now() - t.startedAt) / (60 * 1000)) // minutes
  }

  // Log the action
  await logAction('table_stop', t.customerId || 'unknown', { 
    tableId: id, 
    tableType: t.tableType, 
    rentalTime,
    totalCost: calculateTableCost(t, rentalTime)
  })

  t.status = 'free'
  t.startedAt = null
  t.freeUntil = null
  t.cueRented = false
  delete t.customerId
  delete t.accessCode
  delete t.rentalTime

  // For billiard tables, turn off lights
  if (t.tableType === 'Billiard') {
    t.lightOn = false
  }

  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      await db.collection('mesas').doc(String(id)).set(t, { merge: true })
    } catch {}
  }
  return res.json({ ok: true, table: t, rentalTime, totalCost: calculateTableCost(t, rentalTime) })
})

// Migrate table (transfer time and orders)
r.post('/:id/migrate', async (req, res) => {
  const { accessCode, toTableId, partialTime } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const fromId = Number(req.params.id)
  const toId = Number(toTableId)
  
  const fromTable = TABLES.find((t) => t.id === fromId)
  const toTable = TABLES.find((t) => t.id === toId)
  
  if (!fromTable || !toTable) return res.status(404).json({ error: 'Table not found' })
  if (toTable.status !== 'free') return res.status(400).json({ error: 'Destination table is not available' })
  if (fromTable.accessCode !== accessCode) return res.status(401).json({ error: 'Access code mismatch' })

  // Calculate remaining time
  let remainingTime = 0
  if (fromTable.startedAt) {
    remainingTime = Math.max(0, fromTable.freeUntil! - Date.now())
  }

  // Transfer to new table
  toTable.status = 'occupied'
  toTable.startedAt = Date.now()
  toTable.freeUntil = Date.now() + remainingTime
  
  // Only assign if the properties exist
  if (fromTable.customerId) {
    toTable.customerId = fromTable.customerId
  }
  if (fromTable.accessCode) {
    toTable.accessCode = fromTable.accessCode
  }
  if (fromTable.rentalTime) {
    toTable.rentalTime = fromTable.rentalTime
  }

  // For billiard tables, transfer light control
  if (toTable.tableType === 'Billiard') {
    toTable.lightOn = true
  }

  // Free original table
  fromTable.status = 'free'
  fromTable.startedAt = null
  fromTable.freeUntil = null
  delete fromTable.customerId
  delete fromTable.accessCode
  delete fromTable.rentalTime
  if (fromTable.tableType === 'Billiard') {
    fromTable.lightOn = false
  }

  // Log the migration
  await logAction('table_migration', fromTable.customerId || 'unknown', { 
    fromTableId: fromId, 
    toTableId: toId, 
    remainingTime,
    partialTime: !!partialTime
  })

  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      await db.collection('mesas').doc(String(fromId)).set(fromTable, { merge: true })
      await db.collection('mesas').doc(String(toId)).set(toTable, { merge: true })
    } catch {}
  }

  return res.json({ 
    ok: true, 
    fromTable, 
    toTable, 
    remainingTime,
    ordersTransferred: true
  })
})

// Control billiard table lights
r.post('/:id/light', async (req, res) => {
  const { accessCode, lightOn } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const id = Number(req.params.id)
  const t = TABLES.find((t) => t.id === id)
  if (!t) return res.status(404).json({ error: 'Not found' })
  
  if (t.tableType !== 'Billiard') {
    return res.status(400).json({ error: 'Only billiard tables support light control' })
  }
  
  if (t.accessCode !== accessCode) {
    return res.status(401).json({ error: 'Access code mismatch' })
  }

  t.lightOn = lightOn

  // Log the action
  await logAction('light_control', t.customerId || 'unknown', { 
    tableId: id, 
    lightOn,
    tableType: t.tableType
  })

  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      await db.collection('mesas').doc(String(id)).set(t, { merge: true })
    } catch {}
  }

  return res.json({ ok: true, table: t })
})

// Calculate table cost based on type and time
function calculateTableCost(table: Table, rentalTime: number): number {
  if (table.tableType === 'Billiard') {
    const hourlyRate = 10.00 // Standard rate
    const hours = rentalTime / 60
    return Math.ceil(hours) * hourlyRate
  }
  return 0 // Normal and La Barra tables are free
}

// List items for current session of a mesa (Firestore only; empty otherwise)
r.get('/:id/items', async (req, res) => {
  if (process.env.USE_FIRESTORE !== 'true') return res.json({ items: [] })
  try {
    const id = Number(req.params.id)
    const db = getDb()
    const mesaSnap = await db.collection('mesas').doc(String(id)).get()
    const mesa = mesaSnap.data() as any
    const sessionId: string | undefined = mesa?.currentSessionId
    if (!sessionId) return res.json({ items: [] })
    const itemsSnap = await db.collection('orderItems').where('sessionId', '==', sessionId).limit(500).get()
    const items = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    return res.json({ items, sessionId })
  } catch (e) {
    return res.json({ items: [] })
  }
})

export default r