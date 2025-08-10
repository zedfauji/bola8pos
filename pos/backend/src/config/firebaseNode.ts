import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import fs from 'fs'

export function getDb(): Firestore {
  if (getApps().length === 0) {
    const keyPath = process.env.FIREBASE_CREDENTIALS
    if (keyPath && fs.existsSync(keyPath)) {
      const svc = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))
      ;(initializeApp as unknown as (o?: any) => any)({ credential: cert(svc) })
    } else {
      ;(initializeApp as unknown as (o?: any) => any)({ credential: applicationDefault() })
    }
  }
  return getFirestore()
}


