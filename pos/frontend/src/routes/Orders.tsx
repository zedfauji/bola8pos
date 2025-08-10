import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  description?: string
}

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  notes?: string
}

const menuItems: MenuItem[] = [
  // Bebidas
  { id: '1', name: 'Cerveza', price: 45, category: 'Bebidas', description: 'Cerveza nacional' },
  { id: '2', name: 'Michelada', price: 65, category: 'Bebidas', description: 'Con clamato y especias' },
  { id: '3', name: 'Agua Mineral', price: 25, category: 'Bebidas' },
  { id: '4', name: 'Refresco', price: 30, category: 'Bebidas' },
  
  // Comida
  { id: '5', name: 'Hamburguesa Clásica', price: 120, category: 'Comida', description: 'Con papas incluidas' },
  { id: '6', name: 'Papas Fritas', price: 45, category: 'Comida' },
  { id: '7', name: 'Ensalada César', price: 85, category: 'Comida' },
  { id: '8', name: 'Nuggets de Pollo', price: 75, category: 'Comida' },
  
  // Snacks
  { id: '9', name: 'Cacahuates', price: 25, category: 'Snacks' },
  { id: '10', name: 'Botanas', price: 35, category: 'Snacks' },
  { id: '11', name: 'Chips', price: 30, category: 'Snacks' },
  
  // Combos
  { id: '12', name: 'Combo 1: Hamburguesa + Bebida', price: 140, category: 'Combos', description: 'Ahorra $25' },
  { id: '13', name: 'Combo 2: Papas + Bebida', price: 60, category: 'Combos', description: 'Ahorra $15' },
]

export default function Orders() {
  const [searchParams] = useSearchParams()
  const defaultTable = searchParams.get('table') || ''
  
  const [selectedTable, setSelectedTable] = useState(defaultTable)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [showPayment, setShowPayment] = useState(false)

  const categories = ['all', ...Array.from(new Set(menuItems.map(item => item.category)))]
  
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const addToOrder = (item: MenuItem) => {
    const existingItem = orderItems.find(orderItem => orderItem.id === item.id)
    if (existingItem) {
      setOrderItems(prev => prev.map(orderItem => 
        orderItem.id === item.id 
          ? { ...orderItem, quantity: orderItem.quantity + 1 }
          : orderItem
      ))
    } else {
      setOrderItems(prev => [...prev, { ...item, quantity: 1 }])
    }
  }

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems(prev => prev.filter(item => item.id !== itemId))
    } else {
      setOrderItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, quantity } : item
      ))
    }
  }

  const updateNotes = (itemId: string, notes: string) => {
    setOrderItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, notes } : item
    ))
  }

  const getSubtotal = () => orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const getTax = () => getSubtotal() * 0.16
  const getTotal = () => getSubtotal() + getTax()

  const handlePayment = () => {
    if (!selectedTable || orderItems.length === 0) return
    setShowPayment(true)
  }

  const processOrder = () => {
    // Here you would typically send the order to the backend
    alert('Orden procesada exitosamente!')
    setOrderItems([])
    setCustomerName('')
    setCustomerPhone('')
    setShowPayment(false)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-display text-3xl mb-2">Nueva Orden</h1>
          <p className="text-subheading text-gray-400">Crear y gestionar órdenes de clientes</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{orderItems.length}</div>
            <div className="text-sm text-gray-400">Items</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">${getTotal().toFixed(2)}</div>
            <div className="text-sm text-gray-400">Total</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Menu Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Table Selection */}
          <div className="pos-card p-6">
            <h2 className="text-heading mb-4">Selección de Mesa</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa 6', 'Mesa 7', 'Mesa 8', 'Barra'].map((table) => (
                <button
                  key={table}
                  onClick={() => setSelectedTable(table)}
                  className={`p-3 rounded-lg text-center transition-all duration-200 ${
                    selectedTable === table
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {table}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items */}
          <div className="pos-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-heading">Menú</h2>
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  placeholder="Buscar items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pos-input w-64"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pos-input w-40"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'Todas' : category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="pos-card p-4 cursor-pointer hover:scale-105 transition-transform duration-200"
                  onClick={() => addToOrder(item)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-medium">{item.name}</h3>
                    <span className="text-green-400 font-bold">${item.price}</span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-400 mb-2">{item.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                      {item.category}
                    </span>
                    <button className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center hover:bg-green-700 transition-colors">
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Section */}
        <div className="space-y-6">
          {/* Current Order */}
          <div className="pos-card p-6">
            <h2 className="text-heading mb-4">Orden Actual</h2>
            
            {orderItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📋</div>
                <p>No hay items en la orden</p>
                <p className="text-sm">Selecciona items del menú</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orderItems.map((item) => (
                  <div key={item.id} className="p-3 bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-white font-medium">{item.name}</h4>
                        <p className="text-sm text-gray-400">${item.price} c/u</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700"
                        >
                          -
                        </button>
                        <span className="text-white font-medium w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center hover:bg-green-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Notas especiales..."
                      value={item.notes || ''}
                      onChange={(e) => updateNotes(item.id, e.target.value)}
                      className="pos-input w-full text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Summary */}
          {orderItems.length > 0 && (
            <div className="pos-card p-6">
              <h3 className="text-heading mb-4">Resumen de Orden</h3>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Subtotal:</span>
                  <span className="text-white">${getSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">IVA (16%):</span>
                  <span className="text-white">${getTax().toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-600 pt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-white">Total:</span>
                    <span className="text-2xl font-bold text-green-400">${getTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handlePayment}
                disabled={!selectedTable}
                className="pos-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proceder al Pago
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="pos-card p-8 max-w-md w-full mx-4">
            <h2 className="text-heading mb-6">Información del Cliente</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Nombre del Cliente</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pos-input w-full"
                  placeholder="Nombre completo"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Teléfono</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="pos-input w-full"
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="pos-input w-full"
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowPayment(false)}
                className="pos-button-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={processOrder}
                className="pos-button flex-1"
              >
                Procesar Orden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}