export type TableStatus = 'free' | 'occupied'

export interface BilliardTable {
  id: number
  name: string
  startedAt: number | null
  freeUntil: number | null
  status: TableStatus
  cueRented: boolean
}

export interface WaitlistEntry {
  id: string
  name: string
  createdAt: number
}

export type LocalOrder = { id: string; payload: any; createdAt: number }


