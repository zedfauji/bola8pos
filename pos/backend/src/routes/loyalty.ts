import { Router } from 'express'
import { z } from 'zod'
const r = Router()

const LOYALTY: Record<string, number> = Object.create(null)

export function addPoints(customerId: string, points: number) {
  if (!customerId) return
  LOYALTY[customerId] = (LOYALTY[customerId] || 0) + Math.max(0, points)
}

export function getPoints(customerId: string): number {
  return LOYALTY[customerId] || 0
}

r.get('/', (_req, res) => res.json({ customers: Object.entries(LOYALTY).map(([id, points]) => ({ id, points })) }))

r.get('/:id', (req, res) => {
  const id = req.params.id
  return res.json({ id, points: getPoints(id) })
})

r.post('/accrue', (req, res, next) => {
  const schema = z.object({ customerId: z.string().min(1), points: z.number().int().positive() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return next({ status: 400, code: 'INVALID_BODY', message: 'Invalid accrue payload', issues: parsed.error.issues })
  const { customerId, points } = parsed.data
  addPoints(customerId, points)
  return res.json({ ok: true, id: customerId, points: getPoints(customerId) })
})

r.post('/redeem', (req, res, next) => {
  const schema = z.object({ customerId: z.string().min(1), points: z.number().int().positive() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return next({ status: 400, code: 'INVALID_BODY', message: 'Invalid redeem payload', issues: parsed.error.issues })
  const { customerId, points } = parsed.data
  const current = getPoints(customerId)
  if (current < points) return res.status(400).json({ ok: false, error: { code: 'INSUFFICIENT_POINTS', message: 'Not enough points' } })
  LOYALTY[customerId] = current - points
  return res.json({ ok: true, id: customerId, points: getPoints(customerId) })
})

r.post('/promotion', (_req, res) => res.json({ ok: true }))

export default r