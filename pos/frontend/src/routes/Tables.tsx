import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_URL } from '../services/api'
import type { BilliardTable, WaitlistEntry } from '../types'
import { loadTables, saveTables, loadWaitlist, saveWaitlist } from '../lib/indexedDb'
import { api } from '../services/api'

const TABLE_COUNT = 12

export default function Tables() {
  const [tables, setTables] = useState<BilliardTable[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [, forceTick] = useState(0)
  const intervalRef = useRef<number | null>(null)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [chargeTable, setChargeTable] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTableId, setModalTableId] = useState<number | null>(null)
  const [selectedTable, setSelectedTable] = useState<BilliardTable | null>(null)

  useEffect(() => {
    ;(async () => {
      const storedTables = await loadTables()
      const initTables =
        storedTables ??
        Array.from({ length: TABLE_COUNT }).map((_, idx) => ({
          id: idx + 1,
          name: `Mesa ${idx + 1}`,
          startedAt: null,
          freeUntil: null,
          status: 'free',
          cueRented: false,
        }))
      setTables(initTables)

      const storedWaitlist = await loadWaitlist()
      setWaitlist(storedWaitlist ?? [])
    })()
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    intervalRef.current = window.setInterval(() => forceTick((n) => n + 1), 1000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  function startTable(tableId: number) {
    const now = Date.now()
    api.startTable(tableId).catch(() => {})
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              status: 'occupied',
              startedAt: now + 10 * 60 * 1000,
              freeUntil: now + 10 * 60 * 1000,
            }
          : t
      )
    )
    setTimeout(() => saveTablesLatest(), 0)
  }

  function stopTable(tableId: number) {
    api.stopTable(tableId).catch(() => {})
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? { ...t, status: 'free', startedAt: null, freeUntil: null, cueRented: false }
          : t
      )
    )
    setTimeout(() => saveTablesLatest(), 0)
  }

  function toggleCue(tableId: number) {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, cueRented: !t.cueRented } : t)))
    setTimeout(() => saveTablesLatest(), 0)
  }

  function openCharge(tableName: string) {
    setChargeTable(tableName)
    setChargeOpen(true)
  }

  function getTimeDisplay(table: BilliardTable) {
    if (table.status === 'free' || !table.startedAt) return 'Libre'
    const now = Date.now()
    if (table.freeUntil && now < table.freeUntil) {
      const ms = table.freeUntil - now
      const totalSeconds = Math.max(0, Math.floor(ms / 1000))
      const m = Math.floor(totalSeconds / 60)
      const s = totalSeconds % 60
      const sPad = String(s).padStart(2, '0')
      return `Gratis: ${m}m ${sPad}s`
    }
    const ms = Math.max(0, now - table.startedAt)
    const totalSeconds = Math.floor(ms / 1000)
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    const sPad = String(s).padStart(2, '0')
    return `${h}h ${m}m ${sPad}s`
  }

  function getTableStatus(table: BilliardTable) {
    if (table.status === 'free') return 'free'
    const now = Date.now()
    if (table.freeUntil && now < table.freeUntil) return 'reserved'
    return 'occupied'
  }

  const occupiedCount = useMemo(() => tables.filter((t) => t.status === 'occupied').length, [tables])
  const freeCount = useMemo(() => tables.filter((t) => t.status === 'free').length, [tables])

  function saveTablesLatest() {
    saveTables(tables).catch(() => {})
  }

  function addToWaitlist() {
    const name = window.prompt('Nombre del cliente')?.trim()
    if (!name) return
    const entry: WaitlistEntry = { id: crypto.randomUUID(), name, createdAt: Date.now() }
    const updated = [...waitlist, entry]
    setWaitlist(updated)
    saveWaitlist(updated).catch(() => {})
  }

  function removeFromWaitlist(id: string) {
    const updated = waitlist.filter((w) => w.id !== id)
    setWaitlist(updated)
    saveWaitlist(updated).catch(() => {})
  }

  async function moveAll(sourceId: number) {
    const destRaw = window.prompt('Mover todo a mesa #:')
    if (!destRaw) return
    const dest = Number(destRaw)
    if (!Number.isFinite(dest) || dest === sourceId) return
    try {
      await api.move({ sourceTableId: sourceId, destTableId: dest, scope: 'all' })
      alert('Movimiento registrado')
    } catch {
      alert('No se pudo registrar el movimiento')
    }
  }

  async function moveItems(sourceId: number) {
    setModalTableId(sourceId)
    setModalOpen(true)
  }

  return (
    <div className="space-y-8">
      {/* Header Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-display text-3xl mb-2">Gestión de Mesas</h1>
          <p className="text-subheading text-gray-400">Control y monitoreo de todas las mesas del establecimiento</p>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">{freeCount}</div>
            <div className="text-sm text-gray-400">Disponibles</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400">{occupiedCount}</div>
            <div className="text-sm text-gray-400">Ocupadas</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400">{TABLE_COUNT}</div>
            <div className="text-sm text-gray-400">Total</div>
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="pos-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-heading">Estado de Mesas</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Libre</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Reservada</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Ocupada</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tables.map((table) => {
            const status = getTableStatus(table)
            const isSelected = selectedTable?.id === table.id
            
            return (
              <div
                key={table.id}
                className={`
                  relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
                  ${isSelected ? 'border-green-400 shadow-lg shadow-green-400/20' : 'border-gray-600'}
                  ${status === 'free' ? 'bg-gray-700 hover:bg-gray-600' : 
                    status === 'reserved' ? 'bg-blue-900/30 hover:bg-blue-900/50' : 
                    'bg-red-900/30 hover:bg-red-900/50'}
                `}
                onClick={() => setSelectedTable(isSelected ? null : table)}
              >
                {/* Status Indicator */}
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
                  status === 'free' ? 'bg-green-500' :
                  status === 'reserved' ? 'bg-blue-500' : 'bg-red-500'
                }`}></div>

                {/* Table Info */}
                <div className="text-center mb-3">
                  <h3 className="text-lg font-semibold text-white mb-1">{table.name}</h3>
                  <p className={`text-sm ${
                    status === 'free' ? 'text-green-400' :
                    status === 'reserved' ? 'text-blue-400' : 'text-red-400'
                  }`}>
                    {getTimeDisplay(table)}
                  </p>
                </div>

                {/* Cue Indicator */}
                {table.cueRented && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-medium">
                    Taco
                  </div>
                )}

                {/* Action Buttons */}
                {isSelected && (
                  <div className="space-y-2 mt-3">
                    {table.status === 'free' ? (
                      <button 
                        onClick={() => startTable(table.id)}
                        className="pos-button w-full text-sm py-2"
                      >
                        Iniciar Mesa
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <button 
                          onClick={() => toggleCue(table.id)}
                          className="pos-button-warning w-full text-sm py-2"
                        >
                          {table.cueRented ? 'Devolver Taco' : 'Rentar Taco'}
                        </button>
                        <button 
                          onClick={() => stopTable(table.id)}
                          className="pos-button-danger w-full text-sm py-2"
                        >
                          Detener Mesa
                        </button>
                        <button 
                          onClick={() => moveAll(table.id)}
                          className="pos-button-secondary w-full text-sm py-2"
                        >
                          Mover Todo
                        </button>
                        <button 
                          onClick={() => moveItems(table.id)}
                          className="pos-button-secondary w-full text-sm py-2"
                        >
                          Mover Items
                        </button>
                        <Link 
                          to={`/orders?table=${encodeURIComponent(table.name)}`}
                          className="pos-button w-full text-sm py-2 block text-center"
                        >
                          Nueva Orden
                        </Link>
                        <button 
                          onClick={() => openCharge(table.name)}
                          className="pos-button-secondary w-full text-sm py-2"
                        >
                          Cobrar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Waitlist */}
      <div className="pos-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-heading">Lista de Espera</h2>
          <button 
            onClick={addToWaitlist}
            className="pos-button-secondary px-4 py-2 text-sm"
          >
            Agregar Cliente
          </button>
        </div>
        
        {waitlist.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📝</div>
            <p>No hay clientes en lista de espera</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waitlist.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">👤</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{entry.name}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(entry.createdAt).toLocaleTimeString('es-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => removeFromWaitlist(entry.id)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modalOpen && <ItemsModal tableId={modalTableId!} onClose={() => setModalOpen(false)} />}
      {chargeOpen && (
        <ChargeModal tableName={chargeTable} onClose={() => setChargeOpen(false)} />
      )}
    </div>
  )
}

import { useEffect as useEffect2, useState as useState2 } from 'react'
import { api as apiClient } from '../services/api'

function ItemsModal({ tableId, onClose }: { tableId: number; onClose: () => void }) {
  const [loading, setLoading] = useState2(true)
  const [items, setItems] = useState2<Array<{ id: string; sku?: string; name?: string }>>([])
  const [selected, setSelected] = useState2<Record<string, boolean>>({})
  const [dest, setDest] = useState2('')

  useEffect2(() => {
    ;(async () => {
      try {
        const data = await apiClient.listTableItems(tableId)
        setItems((data.items || []).map((it: any) => ({ id: it.id, sku: it.sku, name: it.name })))
      } finally {
        setLoading(false)
      }
    })()
  }, [tableId])

  async function submitMove() {
    const destId = Number(dest)
    const itemIds = Object.keys(selected).filter((k) => selected[k])
    if (!Number.isFinite(destId) || itemIds.length === 0) return
    await apiClient.move({ sourceTableId: tableId, destTableId: destId, scope: 'items', itemIds })
    onClose()
    alert('Movimiento de items registrado')
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded p-4 w-full max-w-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Items en Mesa {tableId}</div>
          <button onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div className="text-sm text-gray-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-500">Sin items</div>
        ) : (
          <ul className="max-h-64 overflow-auto border rounded mb-3">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-2 p-2 border-b">
                <input type="checkbox" checked={!!selected[it.id]} onChange={(e)=>setSelected({ ...selected, [it.id]: e.target.checked })} />
                <span className="text-sm">{it.name || it.sku || it.id}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <input value={dest} onChange={(e)=>setDest(e.target.value)} className="border rounded px-2 py-1" placeholder="Mover a mesa #" />
          <button onClick={submitMove} className="bg-yellow-200 rounded px-3 py-2">Mover Seleccionados</button>
        </div>
      </div>
    </div>
  )
}



type ChargeItem = { id: string; name: string; price: number }
const QUICK_MENU: ChargeItem[] = [
  { id: 'c1', name: 'Cerveza', price: 45 },
  { id: 'c2', name: 'Michelada', price: 75 },
  { id: 'f1', name: 'Hamburguesa', price: 120 },
  { id: 'f2', name: 'Papas', price: 60 },
]

function ChargeModal({ tableName, onClose }: { tableName: string; onClose: () => void }) {
  const [lines, setLines] = useState2<Array<{ item: ChargeItem; qty: number }>>([])
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0)
  const [openItems, setOpenItems] = useState2<Array<{ id: string; qty: number; price?: number; name?: string }>>([])
  const [loadingOpen, setLoadingOpen] = useState2(false)

  useEffect2(() => {
    ;(async () => {
      setLoadingOpen(true)
      try {
        const res = await fetch(`${API_URL}/api/orders/by-table/${encodeURIComponent(tableName)}`)
        const data = await res.json()
        setOpenItems(data.items || [])
      } finally {
        setLoadingOpen(false)
      }
    })()
  }, [tableName])

  function addItem(ci: ChargeItem) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.item.id === ci.id)
      if (idx >= 0) {
        const copy = prev.slice()
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }
        return copy
      }
      return [...prev, { item: ci, qty: 1 }]
    })
  }

  function decItem(id: string) {
    setLines((prev) => prev.map((l) => (l.item.id === id ? { ...l, qty: Math.max(0, l.qty - 1) } : l)).filter((l) => l.qty > 0))
  }

  async function payNow() {
    if (lines.length === 0) return
    const items = lines.map((l) => ({ id: l.item.id, qty: l.qty }))
    try {
      await fetch(`${API_URL}/api/orders/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, table: tableName }),
      })
      // mark any open orders for the table as completed
      try {
        await fetch(`${API_URL}/api/orders/complete-by-table`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: tableName }),
        })
      } catch {}
      alert('Cobrado')
      onClose()
    } catch {
      alert('No se pudo cobrar la mesa')
    }
  }

  async function sendToKitchen() {
    const expanded: Array<{ id: string }> = []
    lines.forEach((l) => { for (let i = 0; i < l.qty; i++) expanded.push({ id: l.item.id }) })
    if (expanded.length === 0) return
    try {
      await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: expanded, table: tableName }),
      })
      alert('Enviado a cocina')
      onClose()
    } catch {
      alert('No se pudo enviar a cocina')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded p-4 w-full max-w-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Cobrar {tableName}</div>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {QUICK_MENU.map((mi) => (
            <button key={mi.id} onClick={() => addItem(mi)} className="bg-gray-100 rounded p-3 text-left">
              <div className="font-medium">{mi.name}</div>
              <div className="text-sm">${mi.price}</div>
            </button>
          ))}
        </div>
        <div className="border rounded p-2 mb-3">
          <div className="font-medium mb-1">Ticket</div>
          {lines.length === 0 ? (
            <div className="text-sm text-gray-500">Sin items</div>
          ) : (
            <ul className="text-sm divide-y">
              {lines.map((l) => (
                <li key={l.item.id} className="flex items-center justify-between py-1">
                  <span>{l.item.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => decItem(l.item.id)} className="px-2 py-1 bg-gray-200 rounded">-</button>
                    <span className="w-6 text-center">{l.qty}</span>
                    <button onClick={() => addItem(l.item)} className="px-2 py-1 bg-gray-200 rounded">+</button>
                    <span className="w-16 text-right">${l.item.price * l.qty}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between font-semibold mt-2">
            <span>Total</span>
            <span>${total}</span>
          </div>
        </div>
        <div className="border rounded p-2 mb-3">
          <div className="font-medium mb-1">Abiertos</div>
          {loadingOpen ? (
            <div className="text-sm text-gray-500">Cargando…</div>
          ) : openItems.length === 0 ? (
            <div className="text-sm text-gray-500">Sin items abiertos</div>
          ) : (
            <ul className="text-sm divide-y">
              {openItems.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-1">
                  <span>{o.name || o.id}</span>
                  <span className="w-16 text-right">{o.qty} × ${o.price ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
          {openItems.length > 0 && (
            <button
              className="mt-2 bg-gray-200 rounded px-3 py-2"
              onClick={() => {
                // Merge open items into the current ticket (one unit per qty)
                openItems.forEach((oi) => {
                  const found = QUICK_MENU.find((m) => m.id === oi.id) || { id: oi.id, name: oi.name || oi.id, price: oi.price ?? 0 }
                  for (let i = 0; i < oi.qty; i++) addItem(found as ChargeItem)
                })
              }}
            >Agregar Abiertos al Ticket</button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={sendToKitchen} className="flex-1 bg-[#32CD32] text-white rounded px-3 py-2">Enviar a Cocina</button>
          <button onClick={payNow} className="flex-1 bg-purple-700 text-white rounded px-3 py-2">Cobrar</button>
        </div>
      </div>
    </div>
  )
}