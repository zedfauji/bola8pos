import { Router } from 'express'
const r = Router()

r.get('/', (_req, res) => res.json({ customers: [] }))
r.post('/redeem', (_req, res) => res.json({ ok: true }))
r.post('/promotion', (_req, res) => res.json({ ok: true }))

export default r