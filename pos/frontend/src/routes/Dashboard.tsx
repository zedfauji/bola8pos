import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface StatCard {
  title: string
  value: string
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
  icon: string
  color: string
  gradient: string
}

interface RecentOrder {
  id: string
  table: string
  items: number
  total: number
  status: 'pending' | 'preparing' | 'ready' | 'completed'
  time: string
}

const statCards: StatCard[] = [
  {
    title: 'Ventas Hoy',
    value: '$2,450',
    change: '+12.5%',
    changeType: 'positive',
    icon: '💰',
    color: 'from-green-500 to-green-600',
    gradient: 'from-green-500 via-emerald-600 to-teal-600'
  },
  {
    title: 'Mesas Ocupadas',
    value: '8/12',
    change: '+2',
    changeType: 'positive',
    icon: '🎯',
    color: 'from-blue-500 to-blue-600',
    gradient: 'from-blue-500 via-indigo-600 to-purple-600'
  },
  {
    title: 'Órdenes Pendientes',
    value: '15',
    change: '-3',
    changeType: 'negative',
    icon: '📋',
    color: 'from-orange-500 to-orange-600',
    gradient: 'from-orange-500 via-amber-600 to-yellow-600'
  },
  {
    title: 'Clientes Activos',
    value: '24',
    change: '+5',
    changeType: 'positive',
    icon: '👥',
    color: 'from-purple-500 to-purple-600',
    gradient: 'from-purple-500 via-violet-600 to-indigo-600'
  }
]

const recentOrders: RecentOrder[] = [
  { id: '1', table: 'Mesa 3', items: 4, total: 180, status: 'pending', time: '2 min' },
  { id: '2', table: 'Mesa 7', items: 2, total: 95, status: 'preparing', time: '5 min' },
  { id: '3', table: 'Barra', items: 3, total: 135, status: 'ready', time: '8 min' },
  { id: '4', table: 'Mesa 1', items: 5, total: 220, status: 'completed', time: '12 min' },
]

const quickActions = [
  { label: 'Nueva Orden', path: '/orders', icon: '➕', gradient: 'from-green-500 via-emerald-600 to-teal-600' },
  { label: 'Gestionar Mesas', path: '/tables', icon: '🎯', gradient: 'from-blue-500 via-indigo-600 to-purple-600' },
  { label: 'Ver Cocina', path: '/kds', icon: '👨‍🍳', gradient: 'from-orange-500 via-amber-600 to-yellow-600' },
  { label: 'Inventario', path: '/inventory', icon: '📦', gradient: 'from-indigo-500 via-blue-600 to-cyan-600' },
]

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const getStatusColor = (status: RecentOrder['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'preparing': return 'bg-blue-500'
      case 'ready': return 'bg-green-500'
      case 'completed': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: RecentOrder['status']) => {
    switch (status) {
      case 'pending': return 'Pendiente'
      case 'preparing': return 'Preparando'
      case 'ready': return 'Listo'
      case 'completed': return 'Completado'
      default: return 'Desconocido'
    }
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Welcome Section */}
      <div className="text-center relative">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-3xl"></div>
        <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-700/50 p-8 rounded-3xl border border-gray-600/30 backdrop-blur-xl">
          <h1 className="text-display text-4xl mb-3">¡Bienvenido al Sistema!</h1>
          <p className="text-subheading text-gray-300 mb-4">
            {currentTime.toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-gray-700/50 to-gray-600/50 px-6 py-3 rounded-2xl border border-gray-600/30">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <p className="text-body text-gray-200 font-mono">
              {currentTime.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="pos-grid-4">
        {statCards.map((card, index) => (
          <div key={index} className="stat-card p-6 fade-in" style={{ animationDelay: `${index * 100}ms` }}>
            <div className="flex items-center justify-between mb-4">
              <div className={`w-14 h-14 bg-gradient-to-br ${card.gradient} rounded-2xl flex items-center justify-center shadow-lg`}>
                <span className="text-2xl">{card.icon}</span>
              </div>
              <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
                card.changeType === 'positive' ? 'bg-green-900/50 text-green-300 border border-green-500/30' :
                card.changeType === 'negative' ? 'bg-red-900/50 text-red-300 border border-red-500/30' :
                'bg-gray-700/50 text-gray-300 border border-gray-500/30'
              }`}>
                {card.change}
              </div>
            </div>
            <h3 className="text-caption text-gray-400 mb-2">{card.title}</h3>
            <p className="text-heading text-3xl">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Enhanced Quick Actions */}
      <div className="pos-card p-8">
        <h2 className="text-heading mb-8 text-center">Acciones Rápidas</h2>
        <div className="pos-grid-4">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              to={action.path}
              className="action-card group"
            >
              <div className={`w-20 h-20 bg-gradient-to-br ${action.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-xl`}>
                <span className="text-4xl">{action.icon}</span>
              </div>
              <span className="text-body font-semibold text-white group-hover:text-green-400 transition-colors">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Enhanced Recent Orders & Quick Stats */}
      <div className="pos-grid-2">
        {/* Enhanced Recent Orders */}
        <div className="pos-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-heading">Órdenes Recientes</h2>
            <Link to="/orders" className="text-green-400 hover:text-green-300 text-sm font-medium hover:underline transition-all duration-200">
              Ver Todas →
            </Link>
          </div>
          <div className="space-y-4">
            {recentOrders.map((order, index) => (
              <div key={order.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-700/50 to-gray-600/50 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-all duration-200 group hover:scale-[1.02]">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 ${getStatusColor(order.status)} rounded-full shadow-lg`}></div>
                  <div>
                    <p className="text-white font-semibold group-hover:text-green-400 transition-colors">{order.table}</p>
                    <p className="text-sm text-gray-400">{order.items} items • {order.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-lg">${order.total}</p>
                  <p className="text-xs text-gray-400">{getStatusText(order.status)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Quick Stats */}
        <div className="pos-card p-6">
          <h2 className="text-heading mb-6">Resumen del Día</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl border border-green-500/20 hover:border-green-500/40 transition-all duration-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">📊</span>
                </div>
                <div>
                  <p className="text-white font-semibold">Total Ventas</p>
                  <p className="text-sm text-gray-400">Hoy</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-green-400">$2,450</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">🎯</span>
                </div>
                <div>
                  <p className="text-white font-semibold">Mesas Ocupadas</p>
                  <p className="text-sm text-gray-400">Actualmente</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-blue-400">8/12</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-900/30 to-amber-900/30 rounded-xl border border-orange-500/20 hover:border-orange-500/40 transition-all duration-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl">⏱️</span>
                </div>
                <div>
                  <p className="text-white font-semibold">Tiempo Promedio</p>
                  <p className="text-sm text-gray-400">Por Orden</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-orange-400">12m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced System Status */}
      <div className="pos-card p-8">
        <h2 className="text-heading mb-8 text-center">Estado del Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center space-x-4 p-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-2xl hover:border-green-500/50 transition-all duration-200 group hover:scale-105">
            <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
            <div>
              <p className="text-white font-semibold group-hover:text-green-400 transition-colors">Backend</p>
              <p className="text-sm text-green-400">Operativo</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 p-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-2xl hover:border-green-500/50 transition-all duration-200 group hover:scale-105">
            <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
            <div>
              <p className="text-white font-semibold group-hover:text-green-400 transition-colors">Base de Datos</p>
              <p className="text-sm text-green-400">Conectado</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 p-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-2xl hover:border-green-500/50 transition-all duration-200 group hover:scale-105">
            <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
            <div>
              <p className="text-white font-semibold group-hover:text-green-400 transition-colors">Red</p>
              <p className="text-sm text-green-400">Estable</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
