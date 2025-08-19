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
      {/* Enhanced Header Stats */}
      <div className="text-center relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-3xl blur-3xl"></div>
        <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-700/50 p-8 rounded-3xl border border-gray-600/30 backdrop-blur-xl">
          <h1 className="text-display text-4xl mb-3">Gestión de Mesas</h1>
          <p className="text-subheading text-gray-300 mb-6">Control y monitoreo de todas las mesas del establecimiento</p>
          
          <div className="grid grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">{freeCount}</div>
              <div className="text-sm text-gray-400">Disponibles</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-red-400 mb-2">{occupiedCount}</div>
              <div className="text-sm text-gray-400">Ocupadas</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">{TABLE_COUNT}</div>
              <div className="text-sm text-gray-400">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Tables Grid */}
      <div className="pos-card p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-heading">Estado de Mesas</h2>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
              <span className="text-sm text-gray-300 font-medium">Libre</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"></div>
              <span className="text-sm text-gray-300 font-medium">Reservada</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-red-500 rounded-full shadow-lg shadow-red-500/50"></div>
              <span className="text-sm text-gray-300 font-medium">Ocupada</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {tables.map((table) => {
            const status = getTableStatus(table)
            const isSelected = selectedTable?.id === table.id
            
            return (
              <div
                key={table.id}
                className={`
                  relative p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer group
                  ${isSelected ? 'border-green-400 shadow-2xl shadow-green-400/30 scale-105' : 'border-gray-600/50 hover:border-gray-500'}
                  ${status === 'free' ? 'bg-gradient-to-br from-gray-700/80 to-gray-600/80 hover:from-gray-600/80 hover:to-gray-500/80' : 
                    status === 'reserved' ? 'bg-gradient-to-br from-blue-900/40 to-indigo-900/40 hover:from-blue-900/60 hover:to-indigo-900/60' : 
                    'bg-gradient-to-br from-red-900/40 to-pink-900/40 hover:from-red-900/60 hover:to-pink-900/60'}
                `}
                onClick={() => setSelectedTable(isSelected ? null : table)}
              >
                {/* Status Indicator */}
                <div className={`absolute top-3 right-3 w-4 h-4 rounded-full shadow-lg ${
                  status === 'free' ? 'bg-green-500 shadow-green-500/50' :
                  status === 'reserved' ? 'bg-blue-500 shadow-blue-500/50' : 'bg-red-500 shadow-red-500/50'
                }`}></div>

                {/* Table Info */}
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-white mb-2">{table.name}</h3>
                  <p className={`text-sm font-medium ${
                    status === 'free' ? 'text-green-400' :
                    status === 'reserved' ? 'text-blue-400' : 'text-red-400'
                  }`}>
                    {getTimeDisplay(table)}
                  </p>
                </div>

                {/* Cue Indicator */}
                {table.cueRented && (
                  <div className="absolute top-3 left-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs px-3 py-1 rounded-full font-bold shadow-lg">
                    🎯 Taco
                  </div>
                )}

                {/* Action Buttons */}
                {isSelected && (
                  <div className="space-y-3 mt-4">
                    {table.status === 'free' ? (
                      <button 
                        onClick={() => startTable(table.id)}
                        className="pos-button w-full text-sm py-3 rounded-xl"
                      >
                        Iniciar Mesa
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <button 
                          onClick={() => toggleCue(table.id)}
                          className="pos-button-warning w-full text-sm py-3 rounded-xl"
                        >
                          {table.cueRented ? 'Devolver Taco' : 'Rentar Taco'}
                        </button>
                        <button 
                          onClick={() => stopTable(table.id)}
                          className="pos-button-danger w-full text-sm py-3 rounded-xl"
                        >
                          Detener Mesa
                        </button>
                        <button 
                          onClick={() => moveAll(table.id)}
                          className="pos-button-secondary w-full text-sm py-3 rounded-xl"
                        >
                          Mover Todo
                        </button>
                        <button 
                          onClick={() => moveItems(table.id)}
                          className="pos-button-secondary w-full text-sm py-3 rounded-xl"
                        >
                          Mover Items
                        </button>
                        <Link 
                          to={`/orders?table=${encodeURIComponent(table.name)}`}
                          className="pos-button w-full text-sm py-3 rounded-xl block text-center"
                        >
                          Nueva Orden
                        </Link>
                        <button 
                          onClick={() => openCharge(table.name)}
                          className="pos-button-secondary w-full text-sm py-3 rounded-xl"
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

      {/* Enhanced Waitlist */}
      <div className="pos-card p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-heading">Lista de Espera</h2>
          <button 
            onClick={addToWaitlist}
            className="pos-button-secondary px-6 py-3 text-sm rounded-xl hover:scale-105 transition-transform duration-200"
          >
            Agregar Cliente
          </button>
        </div>
        
        {waitlist.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-lg">No hay clientes en lista de espera</p>
            <p className="text-sm text-gray-500">Los clientes aparecerán aquí cuando se agreguen</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {waitlist.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-6 bg-gradient-to-r from-gray-700/50 to-gray-600/50 rounded-2xl border border-gray-600/30 hover:border-gray-500/50 transition-all duration-200 group hover:scale-105">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">👤</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">{entry.name}</p>
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
                  className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-500/10 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-2xl p-6 w-full max-w-lg border border-gray-600/50 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="font-semibold text-white text-lg">Items en Mesa {tableId}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-600/50 rounded-lg">✕</button>
        </div>
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-8">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-8">Sin items</div>
        ) : (
          <ul className="max-h-64 overflow-auto border border-gray-600/50 rounded-xl mb-4 bg-gray-700/30">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 p-3 border-b border-gray-600/30 last:border-b-0">
                <input type="checkbox" checked={!!selected[it.id]} onChange={(e)=>setSelected({ ...selected, [it.id]: e.target.checked })} className="w-4 h-4 text-green-500 bg-gray-600 border-gray-500 rounded focus:ring-green-500 focus:ring-2" />
                <span className="text-sm text-white">{it.name || it.sku || it.id}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3">
          <input value={dest} onChange={(e)=>setDest(e.target.value)} className="pos-input flex-1" placeholder="Mover a mesa #" />
          <button onClick={submitMove} className="pos-button-warning px-4 py-2 rounded-xl">Mover Seleccionados</button>
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-2xl p-6 w-full max-w-2xl border border-gray-600/50 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="font-semibold text-white text-xl">Cobrar {tableName}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-600/50 rounded-lg">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {QUICK_MENU.map((mi) => (
            <button key={mi.id} onClick={() => addItem(mi)} className="bg-gradient-to-r from-gray-700/50 to-gray-600/50 rounded-xl p-4 text-left border border-gray-600/30 hover:border-gray-500/50 transition-all duration-200 hover:scale-105">
              <div className="font-semibold text-white">{mi.name}</div>
              <div className="text-sm text-gray-300">${mi.price}</div>
            </button>
          ))}
        </div>
        <div className="border border-gray-600/50 rounded-xl p-4 mb-4 bg-gray-700/30">
          <div className="font-semibold text-white mb-3">Ticket</div>
          {lines.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-4">Sin items</div>
          ) : (
            <ul className="text-sm divide-y divide-gray-600/30">
              {lines.map((l) => (
                <li key={l.item.id} className="flex items-center justify-between py-3">
                  <span className="text-white">{l.item.name}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => decItem(l.item.id)} className="w-8 h-8 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors">-</button>
                    <span className="w-8 text-center text-white font-semibold">{l.qty}</span>
                    <button onClick={() => addItem(l.item)} className="w-8 h-8 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors">+</button>
                    <span className="w-20 text-right text-white font-bold">${l.item.price * l.qty}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t border-gray-600/30">
            <span className="text-white">Total</span>
            <span className="text-green-400">${total}</span>
          </div>
        </div>
        <div className="border border-gray-600/50 rounded-xl p-4 mb-6 bg-gray-700/30">
          <div className="font-semibold text-white mb-3">Abiertos</div>
          {loadingOpen ? (
            <div className="text-sm text-gray-400 text-center py-4">Cargando…</div>
          ) : openItems.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-4">Sin items abiertos</div>
          ) : (
            <ul className="text-sm divide-y divide-gray-600/30">
              {openItems.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-3">
                  <span className="text-white">{o.name || o.id}</span>
                  <span className="w-20 text-right text-gray-300">{o.qty} × ${o.price ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
          {openItems.length > 0 && (
            <button
              className="mt-4 w-full bg-gradient-to-r from-gray-600 to-gray-500 text-white rounded-xl px-4 py-3 hover:from-gray-500 hover:to-gray-400 transition-all duration-200"
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
        <div className="flex gap-4">
          <button onClick={sendToKitchen} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl px-6 py-3 font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 hover:scale-105">Enviar a Cocina</button>
          <button onClick={payNow} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl px-6 py-3 font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 hover:scale-105">Cobrar</button>
        </div>
      </div>
    </div>
  )
}