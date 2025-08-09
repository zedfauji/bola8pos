import { Router } from 'express'
const r = Router()

r.get('/', (_req, res) => res.json({ orders: [] }))
r.post('/', (_req, res) => res.json({ ok: true }))
r.post('/:id/send-to-kitchen', (req, res) => {
  res.json({ ok: true, id: req.params.id })
})
r.post('/:id/split', (req, res) => {
  res.json({ ok: true, id: req.params.id })
})

export default r