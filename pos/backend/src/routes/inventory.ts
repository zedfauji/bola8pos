import express, { Router } from 'express'
const r = Router()

type InventoryItem = { sku: string; name: string; qty: number; lowStockThreshold: number; price?: number }
const INVENTORY: InventoryItem[] = [
  { sku: 'c1', name: 'Cerveza', qty: 24, lowStockThreshold: 6, price: 45 },
  { sku: 'c2', name: 'Michelada', qty: 12, lowStockThreshold: 4, price: 75 },
  { sku: 'f1', name: 'Hamburguesa', qty: 10, lowStockThreshold: 3, price: 120 },
  { sku: 'f2', name: 'Papas', qty: 15, lowStockThreshold: 5, price: 60 },
  { sku: 's1', name: 'Chips', qty: 30, lowStockThreshold: 8, price: 35 },
]

r.get('/', (_req, res) => res.json({ items: INVENTORY }))

// Import CSV: header sku,name,qty,lowStockThreshold
function parseCsv(text: string): InventoryItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return []
  const headerLine = lines[0] as string
  const rows = lines.slice(1)
  const cols = headerLine.split(',').map((c) => c.trim().toLowerCase())
  const idx = {
    sku: cols.indexOf('sku'),
    name: cols.indexOf('name'),
    qty: cols.indexOf('qty'),
    low: cols.indexOf('lowstockthreshold'),
    price: cols.indexOf('price'),
  }
  const items = rows
    .map((row) => {
      const parts = row.split(',')
      const skuRaw = idx.sku >= 0 ? parts[idx.sku] : ''
      const sku = (skuRaw ?? '').trim()
      if (!sku) return null
      const nameRaw = idx.name >= 0 ? parts[idx.name] : ''
      const name = ((nameRaw ?? '').trim()) || sku
      const qtyNum = Number(idx.qty >= 0 ? parts[idx.qty] : 0)
      const lowNum = Number(idx.low >= 0 ? parts[idx.low] : 0)
      const qty = Number.isFinite(qtyNum) ? qtyNum : 0
      const lowStockThreshold = Number.isFinite(lowNum) ? lowNum : 0
      const priceNum = Number(idx.price >= 0 ? parts[idx.price] : NaN)
      const price = Number.isFinite(priceNum) ? priceNum : undefined
      const item: InventoryItem = { sku, name, qty, lowStockThreshold, ...(price !== undefined ? { price } : {}) }
      return item
    })
    .filter((it): it is InventoryItem => it !== null)
  return items
}

r.post('/import', express.text({ type: '*/*', limit: '1mb' }), (req, res) => {
  const text = String(req.body || '')
  const items = parseCsv(text)
  for (const it of items) {
    const existing = INVENTORY.find((i) => i.sku === it.sku)
    if (existing) {
      existing.name = it.name
      existing.qty = it.qty
      existing.lowStockThreshold = it.lowStockThreshold
      if (typeof it.price === 'number') existing.price = it.price
    } else {
      INVENTORY.push(it)
    }
  }
  res.json({ ok: true, imported: items.length })
})

r.get('/low-stock', (_req, res) => {
  const low = INVENTORY.filter((i) => i.qty <= i.lowStockThreshold)
  res.json({ items: low })
})

// Record an inventory movement: { sku, type: 'purchase'|'sale'|'adjustment'|'waste', qty }
r.post('/movement', express.json(), (req, res) => {
  const sku = String(req.body?.sku || '')
  const qtyNum = Number(req.body?.qty)
  const type = String(req.body?.type || '') as 'purchase'|'sale'|'adjustment'|'waste'
  if (!sku || !Number.isFinite(qtyNum) || qtyNum <= 0 || !['purchase','sale','adjustment','waste'].includes(type)) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_BODY', message: 'Invalid movement payload' } })
  }
  const item = INVENTORY.find((i) => i.sku === sku)
  if (!item) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Item not found' } })
  let delta = 0
  if (type === 'purchase' || type === 'adjustment') delta = qtyNum
  if (type === 'sale' || type === 'waste') delta = -qtyNum
  item.qty = Math.max(0, item.qty + delta)
  return res.json({ ok: true, item })
})

// Update item price: { sku, price }
r.post('/price', express.json(), (req, res) => {
  const sku = String(req.body?.sku || '')
  const priceNum = Number(req.body?.price)
  if (!sku || !Number.isFinite(priceNum) || priceNum < 0) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_BODY', message: 'Invalid price payload' } })
  }
  const item = INVENTORY.find((i) => i.sku === sku)
  if (!item) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Item not found' } })
  item.price = priceNum
  return res.json({ ok: true, item })
})

export { INVENTORY }
export default r