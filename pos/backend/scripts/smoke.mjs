import http from 'node:http'

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 8080, path, method: 'GET' }, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.end()
  })
}

function post(path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload ?? {})
    const req = http.request(
      { hostname: 'localhost', port: 8080, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve({ status: res.statusCode, body: data }))
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  const health = await get('/health')
  console.log('HEALTH', health.status, health.body)

  const tables = await get('/api/tables')
  console.log('TABLES', tables.status)

  const start = await post('/api/tables/1/start')
  console.log('TABLE START', start.status)

  const order = await post('/api/orders', { items: [{ id: 'c1' }], priority: true, notes: 'Sin sal' })
  console.log('ORDER CREATE', order.status, order.body)

  const kds = await get('/api/orders/kds')
  console.log('KDS', kds.status, kds.body)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


