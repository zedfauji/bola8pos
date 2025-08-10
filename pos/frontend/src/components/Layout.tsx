import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

interface NavItem {
  path: string
  label: string
  icon: string
  color: string
  gradient: string
}

const navItems: NavItem[] = [
  { 
    path: '/tables', 
    label: 'Mesas', 
    icon: '🎯', 
    color: 'from-blue-500 to-blue-600',
    gradient: 'from-blue-500 via-blue-600 to-indigo-600'
  },
  { 
    path: '/orders', 
    label: 'Órdenes', 
    icon: '📋', 
    color: 'from-green-500 to-green-600',
    gradient: 'from-green-500 via-emerald-600 to-teal-600'
  },
  { 
    path: '/kds', 
    label: 'Cocina', 
    icon: '👨‍🍳', 
    color: 'from-orange-500 to-orange-600',
    gradient: 'from-orange-500 via-amber-600 to-yellow-600'
  },
  { 
    path: '/loyalty', 
    label: 'Lealtad', 
    icon: '💎', 
    color: 'from-purple-500 to-purple-600',
    gradient: 'from-purple-500 via-violet-600 to-indigo-600'
  },
  { 
    path: '/inventory', 
    label: 'Inventario', 
    icon: '📦', 
    color: 'from-indigo-500 to-indigo-600',
    gradient: 'from-indigo-500 via-blue-600 to-cyan-600'
  },
  { 
    path: '/employees', 
    label: 'Empleados', 
    icon: '👥', 
    color: 'from-teal-500 to-teal-600',
    gradient: 'from-teal-500 via-cyan-600 to-blue-600'
  },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="pos-container">
      {/* Enhanced Header */}
      <header className="pos-header px-6 py-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-white hover:text-green-400 transition-colors p-2 rounded-lg hover:bg-white/10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🎱</span>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-display text-2xl">Billiard POS</h1>
                <p className="text-caption">Sistema de Punto de Venta Profesional</p>
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center space-x-3 bg-gradient-to-r from-green-900/30 to-emerald-900/30 px-4 py-2 rounded-xl border border-green-500/20">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
              <span className="text-sm text-green-300 font-medium">Sistema Activo</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Usuario</div>
              <div className="text-white font-semibold">Admin</div>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">👤</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Enhanced Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-gray-900/95 via-gray-800/95 to-gray-900/95 border-r border-gray-700/50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-6 h-full flex flex-col">
            <nav className="space-y-3 flex-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      nav-item group relative overflow-hidden
                      ${isActive 
                        ? `bg-gradient-to-r ${item.gradient} text-white shadow-xl scale-105` 
                        : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                      }
                    `}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="text-xl relative z-10">{item.icon}</span>
                    <span className="font-medium relative z-10">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 bg-white rounded-full shadow-lg shadow-white/50"></div>
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Enhanced Quick Stats */}
            <div className="mt-8 p-5 bg-gradient-to-br from-gray-800/80 to-gray-700/80 rounded-2xl border border-gray-600/30 backdrop-blur-xl">
              <h3 className="text-subheading mb-4 text-white font-semibold">Estadísticas Rápidas</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Mesas Ocupadas</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-green-400 font-semibold">8/12</span>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Órdenes Pendientes</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-orange-400 font-semibold">15</span>
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Ventas Hoy</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-400 font-semibold">$2,450</span>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>Ocupación</span>
                  <span>67%</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: '67%' }}></div>
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
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
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
