import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

interface NavItem {
  path: string
  label: string
  icon: string
  color: string
}

const navItems: NavItem[] = [
  { path: '/tables', label: 'Mesas', icon: '🎯', color: 'from-blue-500 to-blue-600' },
  { path: '/orders', label: 'Órdenes', icon: '📋', color: 'from-green-500 to-green-600' },
  { path: '/kds', label: 'Cocina', icon: '👨‍🍳', color: 'from-orange-500 to-orange-600' },
  { path: '/loyalty', label: 'Lealtad', icon: '💎', color: 'from-purple-500 to-purple-600' },
  { path: '/inventory', label: 'Inventario', icon: '📦', color: 'from-indigo-500 to-indigo-600' },
  { path: '/employees', label: 'Empleados', icon: '👥', color: 'from-teal-500 to-teal-600' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="pos-container">
      {/* Header */}
      <header className="pos-header px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-white hover:text-green-400 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🎱</span>
              </div>
              <div>
                <h1 className="text-display text-2xl">Billiard POS</h1>
                <p className="text-caption">Sistema de Punto de Venta Profesional</p>
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-700 px-4 py-2 rounded-lg">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-300">Sistema Activo</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Usuario</div>
              <div className="text-white font-medium">Admin</div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-600 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-6">
            <nav className="space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group
                      ${isActive 
                        ? `bg-gradient-to-r ${item.color} text-white shadow-lg` 
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }
                    `}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Quick Stats */}
            <div className="mt-8 p-4 bg-gray-700 rounded-xl">
              <h3 className="text-subheading mb-3">Estadísticas Rápidas</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Mesas Ocupadas</span>
                  <span className="text-green-400 font-medium">8/12</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Órdenes Pendientes</span>
                  <span className="text-orange-400 font-medium">15</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Ventas Hoy</span>
                  <span className="text-blue-400 font-medium">$2,450</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          
          <div className="fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
