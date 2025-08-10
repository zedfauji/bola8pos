import { getDb } from '../config/firebaseNode'

type MoveEvent = {
  type: 'MOVE_SESSION' | 'MOVE_ITEMS'
  payload: {
    sourceTableId: number
    destTableId: number
    scope: 'all' | 'items'
    itemIds?: string[]
    idempotencyKey?: string
  }
  status: 'pending' | 'processing' | 'done' | 'error'
  createdAt: Date
  updatedAt?: Date
  errorMessage?: string
}

export function startEventProcessor() {
  if (process.env.USE_FIRESTORE !== 'true') return
  const db = getDb()
  const intervalMs = Number(process.env.EVENT_PROCESSOR_INTERVAL_MS || 2000)

  const tick = async () => {
    try {
      const snap = await db
        .collection('events')
        .where('status', '==', 'pending')
        .orderBy('createdAt')
        .limit(5)
        .get()

      for (const doc of snap.docs) {
        await db.runTransaction(async (tx) => {
          const ref = doc.ref
          const current = (await tx.get(ref)).data() as MoveEvent | undefined
          if (!current || current.status !== 'pending') return
          tx.update(ref, { status: 'processing', updatedAt: new Date() })

          const payload = current.payload
          let result: Record<string, unknown> = {}

          if (current.type === 'MOVE_SESSION' || (current.type === 'MOVE_ITEMS' && payload.scope === 'all')) {
            // MOVE_SESSION: reassign mesa currentSessionId from source to dest
            const srcMesaRef = db.collection('mesas').doc(String(payload.sourceTableId))
            const destMesaRef = db.collection('mesas').doc(String(payload.destTableId))
            const [srcMesaSnap, destMesaSnap] = await Promise.all([tx.get(srcMesaRef), tx.get(destMesaRef)])
            const srcMesa = (srcMesaSnap.data() as any) || {}
            const destMesa = (destMesaSnap.data() as any) || {}
            const srcSessionId: string | undefined = srcMesa.currentSessionId

            let destSessionId: string | undefined = destMesa.currentSessionId
            if (!srcSessionId) {
              // nothing to move; just mark done
              result = { note: 'No active session on source mesa' }
            } else {
              if (!destSessionId) {
                // create a new session for destination
                const newSessionRef = db.collection('tableSessions').doc()
                destSessionId = newSessionRef.id
                tx.set(newSessionRef, { tableId: payload.destTableId, openedAt: new Date(), mergedFrom: srcSessionId })
              }
              // Repoint source session to destination table (historical move)
              const srcSessionRef = db.collection('tableSessions').doc(srcSessionId)
              tx.set(srcSessionRef, { tableId: payload.destTableId, movedAt: new Date() }, { merge: true })

              // Update mesa pointers
              tx.set(srcMesaRef, { currentSessionId: null }, { merge: true })
              tx.set(destMesaRef, { currentSessionId: srcSessionId }, { merge: true })
              result = { movedSessionId: srcSessionId, destSessionId }
            }
          } else if (current.type === 'MOVE_ITEMS') {
            // MOVE_ITEMS: reassign specific orderItems to destination session
            const destMesaRef = db.collection('mesas').doc(String(payload.destTableId))
            const destMesaSnap = await tx.get(destMesaRef)
            let destSessionId: string | null = (destMesaSnap.data() as any)?.currentSessionId || null
            if (!destSessionId) {
              const newSessionRef = db.collection('tableSessions').doc()
              destSessionId = newSessionRef.id
              tx.set(newSessionRef, { tableId: payload.destTableId, openedAt: new Date() })
              tx.set(destMesaRef, { currentSessionId: destSessionId }, { merge: true })
            }
            const moved: string[] = []
            for (const itemId of payload.itemIds || []) {
              const itemRef = db.collection('orderItems').doc(itemId)
              tx.set(itemRef, { sessionId: destSessionId, movedAt: new Date() }, { merge: true })
              moved.push(itemId)
            }
            result = { destSessionId, movedCount: moved.length }
          }

          tx.update(ref, { status: 'done', updatedAt: new Date(), result })
        })
      }
    } catch (e) {
      // Swallow errors to keep processor alive
    }
  }

  setInterval(tick, intervalMs)
}


