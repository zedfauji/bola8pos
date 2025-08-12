import { useState } from 'react'

interface Order {
  id: string
  table: string
  items: OrderItem[]
  priority: boolean
  createdAt: Date
  status: 'pending' | 'preparing' | 'ready' | 'completed'
  estimatedTime: number
}

interface OrderItem {
  id: string
  name: string
  quantity: number
  notes?: string
  category: string
}

const mockOrders: Order[] = [
  {
    id: '1',
    table: 'Mesa 3',
    items: [
      { id: '1', name: 'Hamburguesa Clásica', quantity: 2, category: 'Comida', notes: 'Sin cebolla' },
      { id: '2', name: 'Papas Fritas', quantity: 1, category: 'Acompañamiento' }
    ],
    priority: true,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    status: 'preparing',
    estimatedTime: 15
  },
  {
    id: '2',
    table: 'Barra',
    items: [
      { id: '3', name: 'Cerveza', quantity: 3, category: 'Bebidas' },
      { id: '4', name: 'Michelada', quantity: 1, category: 'Bebidas', notes: 'Extra picante' }
    ],
    priority: false,
    createdAt: new Date(Date.now() - 8 * 60 * 1000),
    status: 'pending',
    estimatedTime: 8
  },
  {
    id: '3',
    table: 'Mesa 7',
    items: [
      { id: '5', name: 'Ensalada César', quantity: 1, category: 'Comida' },
      { id: '6', name: 'Agua Mineral', quantity: 2, category: 'Bebidas' }
    ],
    priority: false,
    createdAt: new Date(Date.now() - 12 * 60 * 1000),
    status: 'ready',
    estimatedTime: 10
  }
]

export default function KDS() {
  const [orders, setOrders] = useState<Order[]>(mockOrders)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing' | 'ready'>('all')

  const filteredOrders = orders.filter(order => 
    filter === 'all' || order.status === filter
  )

  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ))
  }

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'preparing': return 'bg-blue-500'
      case 'ready': return 'bg-green-500'
      case 'completed': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'Pendiente'
      case 'preparing': return 'Preparando'
      case 'ready': return 'Listo'
      case 'completed': return 'Completado'
      default: return 'Desconocido'
    }
  }

  const getTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Ahora'
    if (diffMins === 1) return '1 min'
    if (diffMins < 60) return `${diffMins} mins`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours === 1) return '1 hora'
    return `${diffHours} horas`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-display text-3xl mb-2">Sistema de Cocina (KDS)</h1>
          <p className="text-subheading text-gray-400">Gestión y seguimiento de órdenes en tiempo real</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-red-900/30 border border-red-500/30 px-4 py-2 rounded-lg">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-red-400">Modo Cocina</span>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="pos-card p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400 mb-1">
            {orders.filter(o => o.status === 'pending').length}
          </div>
          <div className="text-sm text-gray-400">Pendientes</div>
        </div>
        <div className="pos-card p-4 text-center">
          <div className="text-2xl font-bold text-blue-400 mb-1">
            {orders.filter(o => o.status === 'preparing').length}
          </div>
          <div className="text-sm text-gray-400">Preparando</div>
        </div>
        <div className="pos-card p-4 text-center">
          <div className="text-2xl font-bold text-green-400 mb-1">
            {orders.filter(o => o.status === 'ready').length}
          </div>
          <div className="text-sm text-gray-400">Listos</div>
        </div>
        <div className="pos-card p-4 text-center">
          <div className="text-2xl font-bold text-gray-400 mb-1">
            {orders.filter(o => o.status === 'completed').length}
          </div>
          <div className="text-sm text-gray-400">Completados</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="pos-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-heading">Órdenes Activas</h2>
          <div className="flex space-x-2">
            {(['all', 'pending', 'preparing', 'ready'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {status === 'all' ? 'Todas' : 
                 status === 'pending' ? 'Pendientes' :
                 status === 'preparing' ? 'Preparando' : 'Listas'}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className={`
                pos-card p-6 cursor-pointer transition-all duration-200
                ${selectedOrder?.id === order.id ? 'ring-2 ring-green-400' : ''}
                ${order.priority ? 'border-l-4 border-l-red-500' : ''}
              `}
              onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
            >
              {/* Order Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 ${getStatusColor(order.status)} rounded-full`}></div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{order.table}</h3>
                    <p className="text-sm text-gray-400">#{order.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  {order.priority && (
                    <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full mb-1">
                      PRIORIDAD
                    </div>
                  )}
                  <p className="text-sm text-gray-400">{getTimeAgo(order.createdAt)}</p>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-3 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-medium">{item.name}</span>
                        <span className="text-sm text-gray-400">x{item.quantity}</span>
                      </div>
                      {item.notes && (
                        <p className="text-sm text-yellow-400 mt-1">📝 {item.notes}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{item.category}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Footer */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Tiempo estimado: {order.estimatedTime} min
                </div>
                <div className="text-sm text-gray-400">
                  {getStatusText(order.status)}
                </div>
              </div>

              {/* Action Buttons */}
              {selectedOrder?.id === order.id && (
                <div className="mt-4 space-y-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'preparing')}
                      className="pos-button-secondary w-full text-sm py-2"
                    >
                      Iniciar Preparación
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'ready')}
                      className="pos-button w-full text-sm py-2"
                    >
                      Marcar como Listo
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'completed')}
                      className="pos-button-secondary w-full text-sm py-2"
                    >
                      Entregar al Cliente
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">👨‍🍳</div>
            <p className="text-lg">No hay órdenes {filter === 'all' ? '' : filter === 'pending' ? 'pendientes' : filter === 'preparing' ? 'en preparación' : 'listas'}</p>
            <p className="text-sm">¡La cocina está al día!</p>
          </div>
        )}
      </div>

      {/* Kitchen Timer */}
      <div className="pos-card p-6">
        <h2 className="text-heading mb-4">Temporizador de Cocina</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <div className="text-3xl font-bold text-green-400 mb-2">15:30</div>
            <div className="text-sm text-gray-400">Tiempo Promedio</div>
          </div>
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <div className="text-3xl font-bold text-blue-400 mb-2">08:45</div>
            <div className="text-sm text-gray-400">Más Rápido</div>
          </div>
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <div className="text-3xl font-bold text-red-400 mb-2">22:15</div>
            <div className="text-sm text-gray-400">Más Lento</div>
          </div>
        </div>
      </div>
    </div>
  )
}