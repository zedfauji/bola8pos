import { useEffect, useMemo, useState } from 'react'
import LowStockBadge from '../components/inventory/LowStockBadge'

// Resolve API base URL similar to api.js (prefer Vite env, then window override, then localhost)
let API_URL = 'http://localhost:3001'
try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    // @ts-ignore
    API_URL = import.meta.env.VITE_API_URL
  }
} catch {}
// @ts-ignore
if (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) {
  // @ts-ignore
  API_URL = (window as any).__API_BASE_URL__
}
// Normalize: strip trailing '/api' if present. Endpoints below already include '/api'
API_URL = String(API_URL || '').replace(/\/?api\/?$/, '')

type Item = { sku: string; name: string; qty: number; lowStockThreshold: number }

export default function Inventory() {
  const [items, setItems] = useState<Item[]>([])
  const [csv, setCsv] = useState('')
  const [loading, setLoading] = useState(false)
  const [lowOnly, setLowOnly] = useState<boolean>(() => new URLSearchParams(window.location.search).get('low') === '1')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/inventory`)
      const data = await res.json()
      setItems(data.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // low stock badge is now computed server-side via LowStockBadge

  // Watch URL changes (basic) to keep lowOnly in sync when navigating
  useEffect(() => {
    const onPop = () => setLowOnly(new URLSearchParams(window.location.search).get('low') === '1')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const viewItems = useMemo(() => {
    return lowOnly ? items.filter((it) => it.qty <= it.lowStockThreshold) : items
  }, [items, lowOnly])

  async function importCsv() {
    if (!csv.trim()) return
    setLoading(true)
    try {
      await fetch(`${API_URL}/api/inventory/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: csv,
      })
      setCsv('')
      await load()
      alert('Inventario actualizado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 text-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Inventario</h2>
        <div className="flex items-center gap-2">
          {lowOnly && (
            <button
              className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
              onClick={() => {
                const url = new URL(window.location.href)
                url.searchParams.delete('low')
                window.history.pushState({}, '', url.toString())
                setLowOnly(false)
              }}
            >
              Limpiar filtro
            </button>
          )}
          <LowStockBadge className="ml-2" clickable to="/inventory?low=1" pollMs={15000} notifyOnIncrease />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="pos-card p-3">
          <div className="font-medium mb-2">Importar CSV</div>
          <textarea value={csv} onChange={(e)=>setCsv(e.target.value)} className="w-full h-32 pos-input text-sm" placeholder="sku,name,qty,lowStockThreshold" />
          <div className="mt-2 flex gap-2">
            <button onClick={importCsv} disabled={loading} className="pos-button disabled:opacity-50">Importar</button>
            <button onClick={load} disabled={loading} className="pos-button-secondary">Refrescar</button>
          </div>
        </div>
        <div className="pos-card p-3">
          <div className="font-medium mb-2">Ejemplo</div>
          <pre className="text-xs bg-white/5 p-2 rounded">{`sku,name,qty,lowStockThreshold
c1,Cerveza,24,6
f1,Hamburguesa,10,3`}</pre>
        </div>
      </div>

      <div className="overflow-x-auto pos-table">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">Nombre</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-right p-2">Umbral</th>
              <th className="text-right p-2">Mov.</th>
            </tr>
          </thead>
          <tbody>
            {viewItems.map((it) => (
              <tr key={it.sku} className={`border-t ${it.qty <= it.lowStockThreshold ? 'bg-red-900/20' : ''}`}>
                <td className="p-2">{it.sku}</td>
                <td className="p-2">{it.name}</td>
                <td className="p-2 text-right">{it.qty}</td>
                <td className="p-2 text-right">{it.lowStockThreshold}</td>
                <td className="p-2 text-right">
                  <button
                    className="text-xs bg-green-600 text-white rounded px-2 py-1 mr-1"
                    onClick={async ()=>{ await fetch(`${API_URL}/api/inventory/movement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku: it.sku, type: 'purchase', qty: 1 }) }); await load(); }}
                  >+1</button>
                  <button
                    className="text-xs bg-red-600 text-white rounded px-2 py-1 mr-2"
                    onClick={async ()=>{ await fetch(`${API_URL}/api/inventory/movement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku: it.sku, type: 'sale', qty: 1 }) }); await load(); }}
                  >-1</button>
                  <button
                    className="text-xs bg-white/10 hover:bg-white/20 text-white rounded px-2 py-1"
                    onClick={async ()=>{
                      const p = Number(window.prompt('Nuevo precio', '') || 'NaN')
                      if (!Number.isFinite(p) || p < 0) return
                      await fetch(`${API_URL}/api/inventory/price`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku: it.sku, price: p }) })
                      await load()
                    }}
                  >Precio</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


