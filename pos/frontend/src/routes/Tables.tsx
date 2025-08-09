import { useEffect, useMemo, useRef, useState } from 'react'

type TableStatus = 'free' | 'occupied'

type BilliardTable = {
  id: number
  name: string
  startedAt: number | null
  freeUntil: number | null
  status: TableStatus
  cueRented: boolean
}

const TABLE_COUNT = 12

export default function Tables() {
  const [tables, setTables] = useState<BilliardTable[]>(() =>
    Array.from({ length: TABLE_COUNT }).map((_, idx) => ({
      id: idx + 1,
      name: `Mesa ${idx + 1}`,
      startedAt: null,
      freeUntil: null,
      status: 'free',
      cueRented: false,
    }))
  )
  const [, forceTick] = useState(0)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    intervalRef.current = window.setInterval(() => forceTick((n) => n + 1), 1000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  function startTable(tableId: number) {
    const now = Date.now()
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              status: 'occupied',
              startedAt: now + 10 * 60 * 1000, // billable start after 10 minutes
              freeUntil: now + 10 * 60 * 1000,
            }
          : t
      )
    )
  }

  function stopTable(tableId: number) {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? { ...t, status: 'free', startedAt: null, freeUntil: null, cueRented: false }
          : t
      )
    )
  }

  function toggleCue(tableId: number) {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, cueRented: !t.cueRented } : t)))
  }

  function getTimeDisplay(table: BilliardTable) {
    if (table.status === 'free' || !table.startedAt) return 'Libre'
    const now = Date.now()
    const ms = Math.max(0, now - table.startedAt)
    const totalSeconds = Math.floor(ms / 1000)
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return `${h}h ${m}m ${s}s`
  }

  function getColor(table: BilliardTable) {
    if (table.status === 'free') return 'bg-green-100 border-green-300'
    const now = Date.now()
    if (table.freeUntil && now < table.freeUntil) return 'bg-blue-100 border-blue-300'
    return 'bg-red-100 border-red-300'
  }

  const occupiedCount = useMemo(() => tables.filter((t) => t.status === 'occupied').length, [tables])

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Mesas ({occupiedCount}/{TABLE_COUNT})</h2>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tables.map((t) => (
          <div key={t.id} className={`border rounded-lg p-3 ${getColor(t)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">{t.name}</div>
              {t.cueRented && <span className="text-xs rounded bg-gray-800 text-white px-2 py-0.5">Taco</span>}
            </div>
            <div className="text-sm mb-3">{getTimeDisplay(t)}</div>
            <div className="flex gap-2">
              {t.status === 'free' ? (
                <button onClick={() => startTable(t.id)} className="flex-1 bg-[#1E90FF] text-white rounded px-3 py-2">
                  Iniciar
                </button>
              ) : (
                <>
                  <button onClick={() => toggleCue(t.id)} className="flex-1 bg-gray-200 rounded px-3 py-2">
                    {t.cueRented ? 'Devolver Taco' : 'Rentar Taco'}
                  </button>
                  <button onClick={() => stopTable(t.id)} className="flex-1 bg-red-500 text-white rounded px-3 py-2">
                    Detener
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}