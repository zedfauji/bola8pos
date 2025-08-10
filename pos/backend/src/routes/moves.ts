import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../config/firebaseNode'

const r = Router()

const moveSchema = z.object({
  sourceTableId: z.number().int().positive(),
  destTableId: z.number().int().positive(),
  scope: z.enum(['all', 'items']),
  itemIds: z.array(z.string()).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
})

r.post('/move', async (req, res) => {
  const parsed = moveSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: { code: 'INVALID_BODY', details: parsed.error.issues } })
  const body = parsed.data

  // If Firestore is enabled, record an idempotent event for downstream processors
  if (process.env.USE_FIRESTORE === 'true') {
    try {
      const db = getDb()
      const key = body.idempotencyKey || `move:${body.sourceTableId}->${body.destTableId}:${body.scope}:${Date.now()}`
      const id = Buffer.from(key).toString('base64url').slice(0, 120)
      const docRef = db.collection('events').doc(id)
      const snap = await docRef.get()
      if (!snap.exists) {
        await docRef.set({
          type: body.scope === 'all' ? 'MOVE_SESSION' : 'MOVE_ITEMS',
          payload: body,
          createdAt: new Date(),
          status: 'pending',
        })
      }
    } catch {}
  }

  // For now, in-memory behavior is a no-op with acknowledgment
  return res.json({ ok: true })
})

export default r


