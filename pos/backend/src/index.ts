import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
import tablesRouter from './routes/tables'
import ordersRouter from './routes/orders'
import inventoryRouter from './routes/inventory'
import loyaltyRouter from './routes/loyalty'
import employeesRouter from './routes/employees'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/tables', tablesRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/loyalty', loyaltyRouter)
app.use('/api/employees', employeesRouter)

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

io.on('connection', (socket) => {
  socket.on('disconnect', () => {})
})

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  console.log(`API listening on ${PORT}`)
})