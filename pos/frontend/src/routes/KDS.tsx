import { useMemo, useState } from 'react'

type KdsOrder = {
  id: string
  table: string
  items: string[]
  notes?: string
  createdAt: number
  priority: boolean
  done: boolean
}

export default function KDS() {
  const [orders, setOrders] = useState<KdsOrder[]>([
    { id: 'o1', table: 'Mesa 3', items: ['Hamburguesa', 'Papas'], createdAt: Date.now() - 5 * 60 * 1000, priority: false, done: false },
    { id: 'o2', table: 'Mesa 7', items: ['Michelada'], notes: 'Sin sal', createdAt: Date.now() - 9 * 60 * 1000, priority: true, done: false },
  ])

  function toggleDone(id: string) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, done: !o.done } : o)))
  }

  const sorted = useMemo(
    () => orders.slice().sort((a, b) => Number(b.priority) - Number(a.priority) || a.createdAt - b.createdAt),
    [orders]
  )

  function age(order: KdsOrder) {
    const ms = Date.now() - order.createdAt
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${m}m ${s}s`
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Cocina (KDS)</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {sorted.map((o) => (
          <div key={o.id} className={`border rounded p-3 ${o.priority ? 'bg-yellow-100 border-yellow-300' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">{o.table}</div>
              <div className="text-sm">{age(o)}</div>
            </div>
            <ul className="text-sm list-disc pl-5 mb-2">
              {o.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
            {o.notes && <div className="text-xs italic mb-2">{o.notes}</div>}
            <button
              onClick={() => toggleDone(o.id)}
              className={`rounded px-3 py-2 ${o.done ? 'bg-gray-300' : 'bg-green-500 text-white'}`}
            >
              {o.done ? 'Reabrir' : 'Completar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}