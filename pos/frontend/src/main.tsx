import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Tables from './routes/Tables.tsx'
import Orders from './routes/Orders.tsx'
import KDS from './routes/KDS.tsx'
import Loyalty from './routes/Loyalty.tsx'
import Employees from './routes/Employees.tsx'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/tables', element: <Tables /> },
  { path: '/orders', element: <Orders /> },
  { path: '/kds', element: <KDS /> },
  { path: '/loyalty', element: <Loyalty /> },
  { path: '/employees', element: <Employees /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
