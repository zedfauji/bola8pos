import { useMemo, useState } from 'react'

type Customer = {
  id: string
  name: string
  phone: string
  points: number
  visits: number
}

const MOCK: Customer[] = [
  { id: 'u1', name: 'Juan Perez', phone: '555-123-4567', points: 320, visits: 12 },
  { id: 'u2', name: 'Ana Lopez', phone: '555-987-6543', points: 120, visits: 5 },
]

export default function Loyalty() {
  const [q, setQ] = useState('')
  const customers = useMemo(
    () => MOCK.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q)),
    [q]
  )
  const [selected, setSelected] = useState<Customer | null>(null)

  function redeem() {
    if (!selected) return
    alert(`Redimir puntos de ${selected.name}`)
  }

  function sendPromo() {
    if (!selected) return
    alert(`Enviar promoción a ${selected.name}`)
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Lealtad</h2>
      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono"
          className="w-full border rounded px-3 py-2"
        />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <ul className="divide-y">
            {customers.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.phone}</div>
                </div>
                <button onClick={() => setSelected(c)} className="px-3 py-1 rounded bg-purple-700 text-white">
                  Ver
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {selected ? (
            <div className="border rounded p-3">
              <div className="font-semibold mb-1">{selected.name}</div>
              <div className="text-sm mb-2">Tel: {selected.phone}</div>
              <div className="flex gap-6 mb-3">
                <div>
                  <div className="text-xs text-gray-500">Puntos</div>
                  <div className="text-2xl font-bold text-purple-700">{selected.points}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Visitas</div>
                  <div className="text-2xl font-bold">{selected.visits}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={redeem} className="bg-purple-700 text-white rounded px-3 py-2">
                  Redimir Puntos
                </button>
                <button onClick={sendPromo} className="bg-gray-200 rounded px-3 py-2">Enviar Promoción</button>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">Selecciona un cliente</div>
          )}
        </div>
      </div>
    </div>
  )
}