import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import { getSocket } from '../../lib/socket';

export default function KitchenDisplay() {
  const { kds: kdsCfg, isPinRequired, formatTimeElapsed } = useSettings();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pinModal, setPinModal] = useState({
    isOpen: false,
    orderId: null,
    newStatus: null,
    pin: '',
    error: ''
  });

  // Load orders from API
  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.getKDSOrders();
      setOrders(data?.orders || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch KDS orders:', err);
      setError('Failed to load orders. Please try again.');
      
      // Fallback demo data if API not available
      if (orders.length === 0) {
        setOrders([
          {
            id: 'ORD001',
            table: 'B1',
            kitchenStatus: 'pending',
            items: [
              { id: 'wings', qty: 1, notes: 'Extra spicy' },
              { id: 'fries', qty: 2, notes: 'No salt' }
            ],
            createdAt: Date.now() - 5 * 60 * 1000
          },
          {
            id: 'ORD002',
            table: 'T3',
            kitchenStatus: 'in_progress',
            items: [
              { id: 'margarita', qty: 2, notes: 'No salt, frozen' },
              { id: 'nachos', qty: 1, notes: 'Extra cheese' }
            ],
            createdAt: Date.now() - 10 * 60 * 1000
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [orders.length]);

  // Set up polling + realtime socket subscriptions
  useEffect(() => {
    let isMounted = true;
    const socket = getSocket();
    const onCreated = ({ order }) => {
      setOrders(prev => [order, ...prev]);
    };
    const onStatusChanged = ({ id, status }) => {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, kitchenStatus: status } : o));
    };
    const onCompleted = ({ id }) => {
      setOrders(prev => prev.filter(o => o.id !== id));
    };
    const onRecalled = ({ id }) => {
      // If it exists, mark pending; otherwise trigger a reload
      let found = false;
      setOrders(prev => prev.map(o => {
        if (o.id === id) { found = true; return { ...o, kitchenStatus: 'pending' }; }
        return o;
      }));
      if (!found) fetchOrders().catch(() => {});
    };
    socket.on('order:created', onCreated);
    socket.on('order:status_changed', onStatusChanged);
    socket.on('order:completed', onCompleted);
    socket.on('order:recalled', onRecalled);
    
    const poll = () => {
      if (isMounted) {
        fetchOrders().finally(() => {
          if (isMounted) {
            const interval = Math.max(1000, kdsCfg?.pollIntervalMs || 5000);
            timeoutId = setTimeout(poll, interval);
          }
        });
      }
    };
    
    let timeoutId = setTimeout(poll, 0);
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      socket.off('order:created', onCreated);
      socket.off('order:status_changed', onStatusChanged);
      socket.off('order:completed', onCompleted);
      socket.off('order:recalled', onRecalled);
    };
  }, [fetchOrders, kdsCfg?.pollIntervalMs]);

  // Handle order status update with PIN verification if required
  const handleStatusUpdate = (orderId, newStatus) => {
    if (isPinRequired('kds_status_change')) {
      setPinModal({
        isOpen: true,
        orderId,
        newStatus,
        pin: '',
        error: ''
      });
    } else {
      updateOrderStatus(orderId, newStatus);
    }
  };

  // Update order status on the server
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      // Map UI statuses to backend statuses
      const mapped = newStatus === 'in-progress' ? 'in_progress' : (newStatus === 'completed' ? 'done' : newStatus);
      await api.updateOrderStatus(orderId, { status: mapped });
      
      // Optimistically update the UI
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId 
            ? { ...order, kitchenStatus: mapped } 
            : order
        )
      );
      
      // Close the PIN modal if open
      setPinModal(prev => ({
        ...prev,
        isOpen: false,
        orderId: null,
        newStatus: null,
        pin: ''
      }));
      
    } catch (error) {
      console.error('Failed to update order status:', error);
      setPinModal(prev => ({
        ...prev,
        error: 'Failed to update order status. Please try again.'
      }));
    }
  };

  // Handle PIN submission for protected actions
  const handlePinSubmit = async () => {
    const { orderId, newStatus, pin } = pinModal;
    
    try {
      // Verify PIN with the server
      const { ok } = await api.verifyManagerPin(pin);
      
      if (!ok) {
        setPinModal(prev => ({
          ...prev,
          error: 'Invalid manager PIN',
          pin: ''
        }));
        return;
      }
      
      // If PIN is valid, update the order status
      await updateOrderStatus(orderId, newStatus);
      
    } catch (error) {
      console.error('Failed to verify PIN:', error);
      setPinModal(prev => ({
        ...prev,
        error: 'Failed to verify PIN. Please try again.',
        pin: ''
      }));
    }
  };

  // Render order card
  const renderOrderCard = (order) => {
    const orderTime = order.createdAt ? new Date(order.createdAt) : new Date();
    const elapsedMinutes = Math.floor((Date.now() - orderTime.getTime()) / (1000 * 60));
    const isUrgent = elapsedMinutes > 15; // More than 15 minutes old
    
    return (
      <div 
        key={order.id} 
        className={`bg-gray-900 text-gray-100 rounded-xl shadow-lg p-6 border-l-4 border border-gray-800 ${
          isUrgent ? 'border-red-500' : 'border-blue-500'
        }`}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold">#{order.id}</h3>
            <div className="text-sm text-gray-300">Table {order.table || order.tableId || '—'}</div>
            <div className="text-xs text-gray-400 mt-1">
              {formatTimeElapsed(orderTime)} ago
            </div>
          </div>
          <div 
            className={`px-3 py-1 rounded-full text-white text-sm ${
              order.kitchenStatus === 'pending' ? 'bg-blue-500' :
              order.kitchenStatus === 'in_progress' ? 'bg-orange-500' : 'bg-green-500'
            }`}
          >
            {(order.kitchenStatus || 'pending').replace('_', ' ').toUpperCase()}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {order.items.map((item, idx) => (
            <div key={idx} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="font-medium text-gray-100">
                {(item.qty || item.quantity || 1)}x {item.name || item.itemName || item.title || item.id}
              </div>
              {kdsCfg?.showModifiers && item.notes && (
                <div className="text-xs text-gray-300 mt-1">
                  {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {order.kitchenStatus === 'pending' && (
            <button
              onClick={() => handleStatusUpdate(order.id, 'in-progress')}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg"
            >
              ▶️ Start Preparing
            </button>
          )}
          {order.kitchenStatus === 'in_progress' && (
            <button
              onClick={() => handleStatusUpdate(order.id, 'completed')}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg"
            >
              ✅ Mark as Complete
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 text-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-100">👨‍🍳 Kitchen Display System</h1>
          <div className="flex items-center space-x-4">
            {loading && (
              <div className="flex items-center text-gray-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
                <span>Updating...</span>
              </div>
            )}
            <div className="text-sm text-gray-500">
              Auto-refresh: {Math.floor((kdsCfg?.pollIntervalMs || 5000) / 1000)}s
            </div>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
            <p>{error}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.length > 0 ? (
            orders.map(renderOrderCard)
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">No active orders</p>
              <p className="text-sm text-gray-400 mt-2">New orders will appear here automatically</p>
            </div>
          )}
        </div>
      </div>

      {/* PIN Verification Modal */}
      {pinModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 text-gray-100 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-800">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">Manager Verification Required</h3>
            <form onSubmit={(e)=>{e.preventDefault(); handlePinSubmit();}}>
              <p className="mb-4 text-gray-300">
                Please enter your manager PIN to update order status to{' '}
                <span className="font-semibold">
                  {pinModal.newStatus?.replace('-', ' ').toUpperCase()}
                </span>
                .
              </p>
              
              <input
                type="password"
                value={pinModal.pin}
                onChange={(e) => 
                  setPinModal(prev => ({ ...prev, pin: e.target.value }))
                }
                className="w-full p-2 rounded mb-2 bg-gray-800 text-gray-100 placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                placeholder="Enter manager PIN"
                autoFocus
              />
              
              {pinModal.error && (
                <p className="text-red-300 text-sm mt-1">{pinModal.error}</p>
              )}
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setPinModal({
                    isOpen: false,
                    orderId: null,
                    newStatus: null,
                    pin: '',
                    error: ''
                  })}
                  className="px-4 py-2 text-gray-200 hover:bg-gray-800 border border-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={!pinModal.pin}
                >
                  Verify & Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
