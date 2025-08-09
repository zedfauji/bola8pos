import { Router } from 'express'
const r = Router()

r.get('/', (_req, res) => res.json({ tables: [] }))
r.post('/:id/start', (req, res) => {
  const { id } = req.params
  res.json({ ok: true, id })
})
r.post('/:id/stop', (req, res) => {
  const { id } = req.params
  res.json({ ok: true, id })
})

export default r