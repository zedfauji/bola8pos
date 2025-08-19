import { openDB, type IDBPDatabase } from 'idb'
import type { LocalOrder, WaitlistEntry, BilliardTable } from '../types'

const DB_NAME = 'pos-local'
const DB_VERSION = 2

let cachedDb: IDBPDatabase | null = null

export async function getDb() {
  if (cachedDb) return cachedDb
  cachedDb = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('orders', { keyPath: 'id' })
        db.createObjectStore('inventory', { keyPath: 'sku' })
      }
      if (oldVersion < 2) {
        db.createObjectStore('tables', { keyPath: 'id' })
        db.createObjectStore('waitlist', { keyPath: 'id' })
      }
    },
  })
  return cachedDb
}

export async function saveOfflineOrder(order: LocalOrder) {
  const db = await getDb()
  await db.put('orders', order)
}

export async function listOfflineOrders(): Promise<LocalOrder[]> {
  const db = await getDb()
  return (await db.getAll('orders')) as LocalOrder[]
}

export async function removeOfflineOrder(id: string) {
  const db = await getDb()
  await db.delete('orders', id)
}

export async function saveTables(tables: BilliardTable[]) {
  const db = await getDb()
  const tx = db.transaction('tables', 'readwrite')
  await Promise.all(tables.map((t) => tx.store.put(t)))
  await tx.done
}

export async function loadTables(): Promise<BilliardTable[] | null> {
  const db = await getDb()
  const all = (await db.getAll('tables')) as BilliardTable[]
  return all && all.length ? all : null
}

export async function saveWaitlist(entries: WaitlistEntry[]) {
  const db = await getDb()
  const tx = db.transaction('waitlist', 'readwrite')
  await Promise.all(entries.map((e) => tx.store.put(e)))
  await tx.done
}

export async function loadWaitlist(): Promise<WaitlistEntry[] | null> {
  const db = await getDb()
  const all = (await db.getAll('waitlist')) as WaitlistEntry[]
  return all && all.length ? all : null
}