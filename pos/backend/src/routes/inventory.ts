import { Router } from 'express'
const r = Router()

r.get('/', (_req, res) => res.json({ items: [] }))
r.post('/import', (_req, res) => res.json({ ok: true }))
r.get('/low-stock', (_req, res) => res.json({ items: [] }))

export default r