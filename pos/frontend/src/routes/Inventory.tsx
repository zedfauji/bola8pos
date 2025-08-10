import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../services/api'

type Item = { sku: string; name: string; qty: number; lowStockThreshold: number }

export default function Inventory() {
  const [items, setItems] = useState<Item[]>([])
  const [csv, setCsv] = useState('')
  const [loading, setLoading] = useState(false)

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

  const lowCount = useMemo(() => items.filter((i) => i.qty <= i.lowStockThreshold).length, [items])

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
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Inventario</h2>
        <span className={`text-sm ${lowCount ? 'text-red-600' : 'text-gray-500'}`}>Bajo stock: {lowCount}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border rounded p-3">
          <div className="font-medium mb-2">Importar CSV</div>
          <textarea value={csv} onChange={(e)=>setCsv(e.target.value)} className="w-full h-32 border rounded p-2 text-sm" placeholder="sku,name,qty,lowStockThreshold" />
          <div className="mt-2 flex gap-2">
            <button onClick={importCsv} disabled={loading} className="bg-[#1E90FF] disabled:opacity-50 text-white rounded px-3 py-2">Importar</button>
            <button onClick={load} disabled={loading} className="bg-gray-200 rounded px-3 py-2">Refrescar</button>
          </div>
        </div>
        <div className="border rounded p-3">
          <div className="font-medium mb-2">Ejemplo</div>
          <pre className="text-xs bg-gray-50 p-2 rounded">{`sku,name,qty,lowStockThreshold
c1,Cerveza,24,6
f1,Hamburguesa,10,3`}</pre>
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">Nombre</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-right p-2">Umbral</th>
              <th className="text-right p-2">Mov.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.sku} className={`border-t ${it.qty <= it.lowStockThreshold ? 'bg-red-50' : ''}`}>
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
                    className="text-xs bg-gray-200 rounded px-2 py-1"
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


