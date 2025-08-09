import { openDB } from 'idb'

export type LocalOrder = { id: string; payload: any; createdAt: number }

const DB_NAME = 'pos-local'
const DB_VERSION = 1

export async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('inventory')) {
        db.createObjectStore('inventory', { keyPath: 'sku' })
      }
    },
  })
}

export async function saveOfflineOrder(order: LocalOrder) {
  const db = await getDb()
  await db.put('orders', order)
}

export async function listOfflineOrders(): Promise<LocalOrder[]> {
  const db = await getDb()
  return (await db.getAll('orders')) as LocalOrder[]
}