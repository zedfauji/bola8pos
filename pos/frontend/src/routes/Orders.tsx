import { useState } from 'react'

type MenuItem = { id: string; name: string; price: number; category: string }
const MENU: MenuItem[] = [
  { id: 'c1', name: 'Cerveza', price: 45, category: 'Bebidas' },
  { id: 'c2', name: 'Michelada', price: 75, category: 'Bebidas' },
  { id: 'f1', name: 'Hamburguesa', price: 120, category: 'Comida' },
  { id: 'f2', name: 'Papas', price: 60, category: 'Comida' },
  { id: 's1', name: 'Chips', price: 35, category: 'Snacks' },
]

export default function Orders() {
  const [activeCategory, setActiveCategory] = useState<string>('Bebidas')
  const [items, setItems] = useState<Array<{ item: MenuItem; notes?: string }>>([])

  const categories = Array.from(new Set(MENU.map((m) => m.category)))
  const filtered = MENU.filter((m) => m.category === activeCategory)
  const total = items.reduce((sum, i) => sum + i.item.price, 0)

  function addItem(item: MenuItem) {
    const note = window.prompt('Notas (e.g., sin cebolla, extra queso)?') || undefined
    setItems((prev) => [...prev, { item, notes: note }])
  }
  function clear() {
    setItems([])
  }

  function splitBill() {
    if (items.length === 0) return
    const halves = [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)]
    alert(`Split 1: $${halves[0].reduce((s, it) => s + it.item.price, 0)} | Split 2: $${
      halves[1].reduce((s, it) => s + it.item.price, 0)
    }`)
  }

  function sendToKitchen() {
    alert('Enviado a cocina (KDS)')
  }

  return (
    <div className="p-4">
      <header className="mb-4">
        <h2 className="text-xl font-semibold">Ordenes</h2>
      </header>
      <div className="mb-3 flex gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-2 rounded ${
              activeCategory === cat ? 'bg-[#1E90FF] text-white' : 'bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {filtered.map((m) => (
          <button key={m.id} onClick={() => addItem(m)} className="bg-gray-100 rounded p-3 text-left">
            <div className="font-medium">{m.name}</div>
            <div className="text-sm">${m.price}</div>
          </button>
        ))}
      </div>

      <div className="border rounded p-3">
        <div className="font-medium mb-2">Ticket</div>
        <ul className="space-y-1 text-sm">
          {items.map((it, idx) => (
            <li key={idx} className="flex justify-between">
              <span>
                {it.item.name}
                {it.notes ? ` — ${it.notes}` : ''}
              </span>
              <span>${it.item.price}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between mt-3 font-semibold">
          <span>Total</span>
          <span>${total}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={splitBill} className="bg-gray-300 rounded px-3 py-2">
          Dividir Cuenta
        </button>
        <button onClick={sendToKitchen} className="bg-[#32CD32] text-white rounded px-3 py-2">
          Enviar a Cocina
        </button>
        <button onClick={clear} className="bg-red-500 text-white rounded px-3 py-2">
          Limpiar
        </button>
      </div>
    </div>
  )
}