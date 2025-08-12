import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
// @ts-ignore - JS service without types
import { inventoryApi } from '../../services/inventoryService'
import { useNavigate } from 'react-router-dom'

interface Props {
  threshold?: number
  className?: string
  title?: string
  clickable?: boolean
  to?: string
  pollMs?: number
  notifyOnIncrease?: boolean
}

export default function LowStockBadge({ threshold = 10, className, title = 'Bajo stock', clickable = false, to, pollMs, notifyOnIncrease = false }: Props) {
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const prevCountRef = useRef<number | null>(null)
  const navigate = useNavigate()

  const fetchLowStock = useMemo(() => async () => {
    try {
      const res = await inventoryApi.getLowStock(threshold)
      const arr = Array.isArray(res.data) ? res.data : (res.data?.items || [])
      setCount(arr.length)
      setError(null)
      return arr.length
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo cargar bajo stock')
      return null
    }
  }, [threshold])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const c = await fetchLowStock()
      if (mounted && c !== null) prevCountRef.current = c
    })()
    return () => { mounted = false }
  }, [fetchLowStock])

  // Polling notifier
  useEffect(() => {
    if (!pollMs) return
    const id = setInterval(async () => {
      const newCount = await fetchLowStock()
      if (newCount === null) return
      const prev = prevCountRef.current
      if (typeof prev === 'number' && notifyOnIncrease && newCount > prev) {
        try {
          // Prefer global toast if available
          // @ts-ignore
          if (window && typeof window.toast === 'function') {
            // @ts-ignore
            window.toast(`${title}: ${newCount} (↑${newCount - prev})`, { type: 'warning' })
          }
        } catch {}
      }
      prevCountRef.current = newCount
    }, Math.max(3000, pollMs))
    return () => clearInterval(id)
  }, [pollMs, fetchLowStock, notifyOnIncrease, title])

  const handleClick = () => {
    if (!clickable) return
    if (to) navigate(to)
  }

  if (error) {
    return (
      <span className={clsx('text-xs px-2 py-1 rounded bg-red-900/30 text-red-300', className)} title={error} onClick={handleClick} role={clickable ? 'button' : undefined}>
        {title}: err
      </span>
    )
  }

  if (count === null) {
    return (
      <span className={clsx('text-xs px-2 py-1 rounded bg-white/10 text-white/70 animate-pulse', className)}>
        {title}: …
      </span>
    )
  }

  const danger = count > 0
  return (
    <span
      className={clsx(
        'text-xs px-2 py-1 rounded font-medium',
        danger ? 'bg-red-700/30 text-red-200' : 'bg-white/10 text-white/70',
        clickable ? 'cursor-pointer hover:opacity-80' : '',
        className,
      )}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      title={clickable && to ? `Ir a ${to}` : undefined}
    >
      {title}: {count}
    </span>
  )
}
