import express from 'express'
import cors from 'cors'
import http from 'http'
import morgan from 'morgan'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
import tablesRouter from './routes/tables'
import ordersRouter from './routes/orders'
import inventoryRouter from './routes/inventory'
import loyaltyRouter from './routes/loyalty'
import employeesRouter from './routes/employees'
import movesRouter from './routes/moves'
import kdsRouter from './routes/kds'
import combosRouter from './routes/combos'
import { startEventProcessor } from './services/eventProcessor'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/tables', tablesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/loyalty', loyaltyRouter)
app.use('/api/employees', employeesRouter)
app.use('/api/moves', movesRouter)
app.use('/api/kds', kdsRouter)
app.use('/api/combos', combosRouter)

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
app.set('io', io)

io.on('connection', (socket) => {
  socket.on('disconnect', () => {})
})

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  console.log(`API listening on ${PORT}`)
})

// Background worker for Firestore move events
startEventProcessor()

// Centralized error handler (last)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = Number(err?.status) || 500
  const code = err?.code || 'INTERNAL_ERROR'
  const message = err?.message || 'Internal Server Error'
  const details = err?.issues || undefined
  res.status(status).json({ ok: false, error: { code, message, details } })
})