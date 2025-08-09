import { Router } from 'express'
const r = Router()

r.get('/', (_req, res) => res.json({ employees: [] }))
r.post('/shifts', (_req, res) => res.json({ ok: true }))
r.get('/performance', (_req, res) => res.json({ metrics: [] }))

export default r