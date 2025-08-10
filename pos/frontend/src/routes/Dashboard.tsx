import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface StatCard {
  title: string
  value: string
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
  icon: string
  color: string
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
    color: 'from-green-500 to-green-600'
  },
  {
    title: 'Mesas Ocupadas',
    value: '8/12',
    change: '+2',
    changeType: 'positive',
    icon: '🎯',
    color: 'from-blue-500 to-blue-600'
  },
  {
    title: 'Órdenes Pendientes',
    value: '15',
    change: '-3',
    changeType: 'negative',
    icon: '📋',
    color: 'from-orange-500 to-orange-600'
  },
  {
    title: 'Clientes Activos',
    value: '24',
    change: '+5',
    changeType: 'positive',
    icon: '👥',
    color: 'from-purple-500 to-purple-600'
  }
]

const recentOrders: RecentOrder[] = [
  { id: '1', table: 'Mesa 3', items: 4, total: 180, status: 'pending', time: '2 min' },
  { id: '2', table: 'Mesa 7', items: 2, total: 95, status: 'preparing', time: '5 min' },
  { id: '3', table: 'Barra', items: 3, total: 135, status: 'ready', time: '8 min' },
  { id: '4', table: 'Mesa 1', items: 5, total: 220, status: 'completed', time: '12 min' },
]

const quickActions = [
  { label: 'Nueva Orden', path: '/orders', icon: '➕', color: 'from-green-500 to-green-600' },
  { label: 'Gestionar Mesas', path: '/tables', icon: '🎯', color: 'from-blue-500 to-blue-600' },
  { label: 'Ver Cocina', path: '/kds', icon: '👨‍🍳', color: 'from-orange-500 to-orange-600' },
  { label: 'Inventario', path: '/inventory', icon: '📦', color: 'from-indigo-500 to-indigo-600' },
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
      {/* Welcome Section */}
      <div className="text-center">
        <h1 className="text-display text-3xl mb-2">¡Bienvenido al Sistema!</h1>
        <p className="text-subheading text-gray-400">
          {currentTime.toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
        <p className="text-body text-gray-300 mt-2">
          {currentTime.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="pos-grid-4">
        {statCards.map((card, index) => (
          <div key={index} className="pos-card p-6 fade-in" style={{ animationDelay: `${index * 100}ms` }}>
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center`}>
                <span className="text-2xl">{card.icon}</span>
              </div>
              <div className={`text-sm font-medium px-2 py-1 rounded-full ${
                card.changeType === 'positive' ? 'bg-green-900 text-green-300' :
                card.changeType === 'negative' ? 'bg-red-900 text-red-300' :
                'bg-gray-700 text-gray-300'
              }`}>
                {card.change}
              </div>
            </div>
            <h3 className="text-caption text-gray-400 mb-1">{card.title}</h3>
            <p className="text-heading text-2xl">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="pos-card p-6">
        <h2 className="text-heading mb-6">Acciones Rápidas</h2>
        <div className="pos-grid-4">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              to={action.path}
              className="group block text-center p-6 rounded-xl bg-gray-700 hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
            >
              <div className={`w-16 h-16 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200`}>
                <span className="text-3xl">{action.icon}</span>
              </div>
              <span className="text-body font-medium text-white group-hover:text-green-400 transition-colors">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Orders & Quick Stats */}
      <div className="pos-grid-2">
        {/* Recent Orders */}
        <div className="pos-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-heading">Órdenes Recientes</h2>
            <Link to="/orders" className="text-green-400 hover:text-green-300 text-sm font-medium">
              Ver Todas →
            </Link>
          </div>
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 ${getStatusColor(order.status)} rounded-full`}></div>
                  <div>
                    <p className="text-white font-medium">{order.table}</p>
                    <p className="text-sm text-gray-400">{order.items} items • {order.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">${order.total}</p>
                  <p className="text-xs text-gray-400">{getStatusText(order.status)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="pos-card p-6">
          <h2 className="text-heading mb-6">Resumen del Día</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">📊</span>
                </div>
                <div>
                  <p className="text-white font-medium">Total Ventas</p>
                  <p className="text-sm text-gray-400">Hoy</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-400">$2,450</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">🎯</span>
                </div>
                <div>
                  <p className="text-white font-medium">Mesas Ocupadas</p>
                  <p className="text-sm text-gray-400">Actualmente</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-400">8/12</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">⏱️</span>
                </div>
                <div>
                  <p className="text-white font-medium">Tiempo Promedio</p>
                  <p className="text-sm text-gray-400">Por Orden</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-orange-400">12m</p>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="pos-card p-6">
        <h2 className="text-heading mb-6">Estado del Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <div>
              <p className="text-white font-medium">Backend</p>
              <p className="text-sm text-green-400">Operativo</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <div>
              <p className="text-white font-medium">Base de Datos</p>
              <p className="text-sm text-green-400">Conectado</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <div>
              <p className="text-white font-medium">Red</p>
              <p className="text-sm text-green-400">Estable</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
