#!/usr/bin/env node
// Usage:
//   node scripts/dump_firestore.mjs --project bola8pos --out ../../firestore_export
// Auth:
//   gcloud auth application-default login

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function parseArgs() {
  const args = process.argv.slice(2)
  const params = {}
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]
    const v = args[i + 1]
    if (!k?.startsWith('--')) continue
    params[k.slice(2)] = v
  }
  return params
}

const { project: projectId, out = 'firestore_export', key } = parseArgs()
if (!projectId) {
  console.error('Missing --project <PROJECT_ID>')
  process.exit(1)
}

// Prefer explicit service account, fallback to ADC
let initOptions
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultKeyPath = path.resolve(__dirname, 'serviceAccount.json')
const keyPath = key ? path.resolve(__dirname, '..', key) : (fs.existsSync(defaultKeyPath) ? defaultKeyPath : null)
if (keyPath) {
  const svc = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))
  initOptions = { credential: cert(svc), projectId: projectId || svc.project_id }
} else {
  initOptions = { credential: applicationDefault(), projectId }
}

initializeApp(initOptions)
const db = getFirestore()

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', out)
fs.mkdirSync(outDir, { recursive: true })

async function dumpCollectionRecursive(collectionPath) {
  const [collectionId, ...rest] = collectionPath.split('/')
  const colRef = db.collection(collectionPath)
  const snap = await colRef.get()
  const records = []
  for (const doc of snap.docs) {
    const data = doc.data()
    records.push({ __id: doc.id, ...data })
  }
  const safeName = collectionPath.replace(/[\\/]/g, '__')
  const filePath = path.join(outDir, `${safeName}.json`)
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2))

  // Recurse into subcollections
  for (const doc of snap.docs) {
    const subcols = await doc.ref.listCollections()
    for (const sub of subcols) {
      await dumpCollectionRecursive(`${collectionPath}/${doc.id}/${sub.id}`)
    }
  }
}

async function main() {
  const rootCollections = await db.listCollections()
  const names = rootCollections.map((c) => c.id)
  fs.writeFileSync(path.join(outDir, `__manifest__.json`), JSON.stringify({ projectId, exportedAt: new Date().toISOString(), rootCollections: names }, null, 2))
  for (const c of rootCollections) {
    await dumpCollectionRecursive(c.id)
  }
  console.log(`Exported to ${outDir}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


