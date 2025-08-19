import { Router } from 'express'
import { getDb } from '../config/firebaseNode'
import { z } from 'zod'
const r = Router()

type Combo = {
  id: string
  name: string
  description?: string
  items: Array<{ id: string; qty: number; name?: string; price?: number }>
  price: number
  discount: number
  billiardTimeCredit?: number // minutes
  isActive: boolean
  category?: string
  imageUrl?: string
}

// Sample combos
const COMBOS: Combo[] = [
  {
    id: 'combo_1',
    name: 'Burger + Beer + 1hr Billiard',
    description: 'Classic combo with billiard time credit',
    items: [
      { id: 'burger', qty: 1, name: 'Burger', price: 15.00 },
      { id: 'beer', qty: 1, name: 'Beer', price: 8.00 }
    ],
    price: 25.00,
    discount: 5.00,
    billiardTimeCredit: 60,
    isActive: true,
    category: 'Food & Drink'
  },
  {
    id: 'combo_2',
    name: 'Pizza + Soda + 30min Billiard',
    description: 'Italian combo with billiard time credit',
    items: [
      { id: 'pizza', qty: 1, name: 'Pizza', price: 18.00 },
      { id: 'soda', qty: 1, name: 'Soda', price: 3.00 }
    ],
    price: 20.00,
    discount: 3.00,
    billiardTimeCredit: 30,
    isActive: true,
    category: 'Food & Drink'
  },
  {
    id: 'combo_3',
    name: 'Wings + Fries + 45min Billiard',
    description: 'Snack combo with billiard time credit',
    items: [
      { id: 'wings', qty: 1, name: 'Chicken Wings', price: 12.00 },
      { id: 'fries', qty: 1, name: 'French Fries', price: 5.00 }
    ],
    price: 15.00,
    discount: 2.00,
    billiardTimeCredit: 45,
    isActive: true,
    category: 'Snacks'
  }
]

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

// Get all combos
r.get('/', async (_req, res) => {
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const snap = await db.collection('combos').get()
      const combos = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      return res.json({ combos })
    } catch (e) {
      // fallback to memory
    }
  }
  res.json({ combos: COMBOS })
})

// Get active combos only
r.get('/active', async (_req, res) => {
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const snap = await db.collection('combos').where('isActive', '==', true).get()
      const combos = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      return res.json({ combos })
    } catch (e) {
      // fallback to memory
    }
  }
  const activeCombos = COMBOS.filter(c => c.isActive)
  res.json({ combos: activeCombos })
})

// Get combos by category
r.get('/category/:category', async (req, res) => {
  const category = req.params.category
  
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const snap = await db.collection('combos').where('category', '==', category).where('isActive', '==', true).get()
      const combos = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      return res.json({ combos, category })
    } catch (e) {
      // fallback to memory
    }
  }
  
  const categoryCombos = COMBOS.filter(c => c.category === category && c.isActive)
  res.json({ combos: categoryCombos, category })
})

// Get combo by ID
r.get('/:id', async (req, res) => {
  const id = req.params.id
  
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const comboDoc = await db.collection('combos').doc(id).get()
      
      if (!comboDoc.exists) {
        return res.status(404).json({ error: 'Combo not found' })
      }

      const combo = { id: comboDoc.id, ...comboDoc.data() }
      return res.json({ combo })
    } catch (e) {
      return res.status(500).json({ error: 'Failed to fetch combo' })
    }
  }
  
  const combo = COMBOS.find(c => c.id === id)
  if (!combo) {
    return res.status(404).json({ error: 'Combo not found' })
  }
  
  res.json({ combo })
})

// Create new combo (requires access code)
r.post('/', async (req, res, next) => {
  const { accessCode, employeeId, ...comboData } = req.body
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    items: z.array(z.object({
      id: z.string(),
      qty: z.number().int().positive(),
      name: z.string().optional(),
      price: z.number().positive().optional()
    })).min(1),
    price: z.number().positive(),
    discount: z.number().min(0),
    billiardTimeCredit: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    category: z.string().optional(),
    imageUrl: z.string().url().optional()
  })

  const parsed = schema.safeParse(comboData)
  if (!parsed.success) {
    return next({ 
      status: 400, 
      code: 'INVALID_BODY', 
      message: 'Invalid combo payload', 
      issues: parsed.error.issues 
    })
  }

  const combo: Combo = {
    id: `combo_${Date.now()}`,
    isActive: true,
    name: parsed.data.name,
    items: parsed.data.items.map(item => ({
      id: item.id,
      qty: item.qty,
      ...(item.name && { name: item.name }),
      ...(item.price && { price: item.price })
    })),
    price: parsed.data.price,
    discount: parsed.data.discount,
    ...(parsed.data.description && { description: parsed.data.description }),
    ...(parsed.data.billiardTimeCredit && { billiardTimeCredit: parsed.data.billiardTimeCredit }),
    ...(parsed.data.category && { category: parsed.data.category }),
    ...(parsed.data.imageUrl && { imageUrl: parsed.data.imageUrl })
  }

  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      await db.collection('combos').doc(combo.id).set(combo)
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save combo' })
    }
  } else {
    COMBOS.push(combo)
  }

  // Log the action
  await logAction('combo_created', employeeId || 'unknown', { 
    comboId: combo.id, 
    comboName: combo.name,
    accessCode
  })

  res.json({ ok: true, combo })
})

// Update combo (requires access code)
r.put('/:id', async (req, res, next) => {
  const { accessCode, employeeId, ...updateData } = req.body
  const id = req.params.id
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const schema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    items: z.array(z.object({
      id: z.string(),
      qty: z.number().int().positive(),
      name: z.string().optional(),
      price: z.number().positive().optional()
    })).min(1).optional(),
    price: z.number().positive().optional(),
    discount: z.number().min(0).optional(),
    billiardTimeCredit: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    category: z.string().optional(),
    imageUrl: z.string().url().optional()
  })

  const parsed = schema.safeParse(updateData)
  if (!parsed.success) {
    return next({ 
      status: 400, 
      code: 'INVALID_BODY', 
      message: 'Invalid update payload', 
      issues: parsed.error.issues 
    })
  }

  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const comboRef = db.collection('combos').doc(id)
      const comboDoc = await comboRef.get()
      
      if (!comboDoc.exists) {
        return res.status(404).json({ error: 'Combo not found' })
      }

      await comboRef.update(parsed.data)
      
      // Log the action
      await logAction('combo_updated', employeeId || 'unknown', { 
        comboId: id, 
        updates: parsed.data,
        accessCode
      })

      return res.json({ ok: true, id })
    } catch (e) {
      return res.status(500).json({ error: 'Failed to update combo' })
    }
  } else {
    const comboIndex = COMBOS.findIndex(c => c.id === id)
    if (comboIndex === -1) {
      return res.status(404).json({ error: 'Combo not found' })
    }

    const existingCombo = COMBOS[comboIndex]
    if (existingCombo) {
      COMBOS[comboIndex] = {
        ...existingCombo,
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.items && { 
          items: parsed.data.items.map(item => ({
            id: item.id,
            qty: item.qty,
            ...(item.name && { name: item.name }),
            ...(item.price && { price: item.price })
          }))
        }),
        ...(parsed.data.price && { price: parsed.data.price }),
        ...(parsed.data.discount !== undefined && { discount: parsed.data.discount }),
        ...(parsed.data.billiardTimeCredit !== undefined && { billiardTimeCredit: parsed.data.billiardTimeCredit }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        ...(parsed.data.category !== undefined && { category: parsed.data.category }),
        ...(parsed.data.imageUrl !== undefined && { imageUrl: parsed.data.imageUrl }),
        id: existingCombo.id
      }
    }
    
    // Log the action
    await logAction('combo_updated', employeeId || 'unknown', { 
      comboId: id, 
      updates: parsed.data,
      accessCode
    })

    res.json({ ok: true, combo: COMBOS[comboIndex] })
  }
})

// Delete combo (requires access code)
r.delete('/:id', async (req, res) => {
  const { accessCode, employeeId } = req.body
  const id = req.params.id
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const comboRef = db.collection('combos').doc(id)
      const comboDoc = await comboRef.get()
      
      if (!comboDoc.exists) {
        return res.status(404).json({ error: 'Combo not found' })
      }

      await comboRef.delete()
      
      // Log the action
      await logAction('combo_deleted', employeeId || 'unknown', { 
        comboId: id, 
        accessCode
      })

      return res.json({ ok: true, id })
    } catch (e) {
      return res.status(500).json({ error: 'Failed to delete combo' })
    }
  } else {
    const comboIndex = COMBOS.findIndex(c => c.id === id)
    if (comboIndex === -1) {
      return res.status(404).json({ error: 'Combo not found' })
    }

    const deletedCombo = COMBOS.splice(comboIndex, 1)[0]
    
    if (deletedCombo) {
      // Log the action
      await logAction('combo_deleted', employeeId || 'unknown', { 
        comboId: id, 
        comboName: deletedCombo.name,
        accessCode
      })
    }

    res.json({ ok: true, combo: deletedCombo })
  }
})

// Toggle combo active status (requires access code)
r.post('/:id/toggle', async (req, res) => {
  const { accessCode, employeeId } = req.body
  const id = req.params.id
  
  if (!accessCode || !validateAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const comboRef = db.collection('combos').doc(id)
      const comboDoc = await comboRef.get()
      
      if (!comboDoc.exists) {
        return res.status(404).json({ error: 'Combo not found' })
      }

      const currentStatus = comboDoc.data()?.isActive || false
      const newStatus = !currentStatus
      
      await comboRef.update({ isActive: newStatus })
      
      // Log the action
      await logAction('combo_toggled', employeeId || 'unknown', { 
        comboId: id, 
        oldStatus: currentStatus,
        newStatus: newStatus,
        accessCode
      })

      return res.json({ ok: true, id, isActive: newStatus })
    } catch (e) {
      return res.status(500).json({ error: 'Failed to toggle combo' })
    }
  } else {
    const combo = COMBOS.find(c => c.id === id)
    if (!combo) {
      return res.status(404).json({ error: 'Combo not found' })
    }

    const oldStatus = combo.isActive
    combo.isActive = !oldStatus
    
    // Log the action
    await logAction('combo_toggled', employeeId || 'unknown', { 
      comboId: id, 
      oldStatus: oldStatus,
      newStatus: combo.isActive,
      accessCode
    })

    res.json({ ok: true, combo })
  }
})

export default r
