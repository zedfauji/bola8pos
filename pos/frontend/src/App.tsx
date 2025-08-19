import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './routes/Dashboard'
import Tables from './routes/Tables'
import Orders from './routes/Orders'
import KDS from './routes/KDS'
import Loyalty from './routes/Loyalty'
import Inventory from './routes/Inventory'
import Employees from './routes/Employees'

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tables" element={<Tables />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/kds" element={<KDS />} />
          <Route path="/loyalty" element={<Loyalty />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/employees" element={<Employees />} />
        </Routes>
      </Layout>
    </Router>
  )
}
