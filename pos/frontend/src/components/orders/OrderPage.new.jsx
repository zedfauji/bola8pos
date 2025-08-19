import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';

const OrderPage = () => {
  const { isPinRequired } = useSettings();
  const navigate = useNavigate();
  const { tableId } = useParams();
  
  // State for cart and UI
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('beers');
  const [modifierOpen, setModifierOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modSelections, setModSelections] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Manager approval state
  const [mgrModal, setMgrModal] = useState({
    isOpen: false,
    type: null, // 'void' | 'comp' | 'discount'
    cartItem: null,
    reason: '',
    pin: '',
    error: ''
  });

  // Menu items (could be moved to a separate file or API)
  const menuItems = {
    beers: [
      { id: 'beer1', name: 'Corona Extra', price: 6.50, emoji: '🍺' },
      { id: 'beer2', name: 'Budweiser', price: 5.50, emoji: '🍺' },
      { id: 'beer3', name: 'Heineken', price: 6.00, emoji: '🍺' },
    ],
    food: [
      { 
        id: 'food1', 
        name: 'Buffalo Wings', 
        price: 12.99, 
        emoji: '🍗', 
        modifiers: {
          size: { 
            type: 'single', 
            options: [
              { id: 'sz_s', name: 'Small (6pc)', delta: 0 },
              { id: 'sz_m', name: 'Medium (10pc)', delta: 3 },
              { id: 'sz_l', name: 'Large (16pc)', delta: 7 },
            ]
          },
          spice: { 
            type: 'single', 
            options: [
              { id: 'sp_m', name: 'Mild', delta: 0 },
              { id: 'sp_h', name: 'Hot', delta: 0 },
              { id: 'sp_x', name: 'Extra Hot', delta: 0 },
            ]
          },
          addons: { 
            type: 'multi', 
            options: [
              { id: 'ad_r', name: 'Ranch', delta: 0.5 },
              { id: 'ad_b', name: 'Blue Cheese', delta: 0.5 },
              { id: 'ad_c', name: 'Celery', delta: 0.5 },
            ]
          }
        } 
      },
      // ... other menu items
    ],
    cocktails: [
      // ... cocktail items
    ],
    combos: [
      // ... combo items
    ]
  };

  // Get station for an item (kitchen or bar)
  const getStationForItem = (item) => {
    if (item.id?.startsWith('food') || item.id?.startsWith('combo')) return 'kitchen';
    if (item.id?.startsWith('cocktail') || item.id?.startsWith('beer')) return 'bar';
    return 'bar';
  };

  // Calculate unit price with modifiers
  const getUnitPrice = (item, mods) => {
    let p = item.price;
    if (item.modifiers && mods) {
      for (const [group, sel] of Object.entries(mods)) {
        const def = item.modifiers[group];
        if (!def) continue;
        if (def.type === 'single') {
          const opt = def.options.find(o => o.id === sel);
          if (opt) p += opt.delta || 0;
        } else if (def.type === 'multi') {
          for (const id of sel || []) {
            const opt = def.options.find(o => o.id === id);
            if (opt) p += opt.delta || 0;
          }
        }
      }
    }
    return +(p.toFixed(2));
  };

  // Add item to cart
  const addToCart = (item) => {
    setCart(prev => {
      const idx = prev.findIndex(ci => ci.id === item.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [...prev, { ...item, quantity: 1, modifiers: modSelections }];
    });
    setModSelections({});
    setModifierOpen(false);
  };

  // Handle void/comp actions with PIN verification
  const handleVoidOrComp = (type, item) => {
    if (isPinRequired('void') && type === 'void' || isPinRequired('comp') && type === 'comp') {
      setMgrModal({
        isOpen: true,
        type,
        cartItem: item,
        reason: '',
        pin: '',
        error: ''
      });
      return;
    }
    
    // If no PIN required, perform action directly
    performVoidOrComp(type, item);
  };

  // Perform void/comp action
  const performVoidOrComp = async (type, item) => {
    try {
      setLoading(true);
      
      if (type === 'void') {
        // Remove item from cart
        setCart(prev => prev.filter(i => i.id !== item.id));
      } else if (type === 'comp') {
        // Mark item as comped
        setCart(prev => 
          prev.map(i => 
            i.id === item.id 
              ? { ...i, status: 'comped', compReason: mgrModal.reason } 
              : i
          )
        );
      }
      
      // Close modal
      setMgrModal({ isOpen: false, type: null, cartItem: null, reason: '', pin: '', error: '' });
      
    } catch (error) {
      console.error(`Failed to ${type} item:`, error);
      setMgrModal(prev => ({
        ...prev,
        error: `Failed to ${type} item: ${error.message}`
      }));
    } finally {
      setLoading(false);
    }
  };

  // Handle PIN submission for manager actions
  const handlePinSubmit = async () => {
    const { type, cartItem, pin, reason } = mgrModal;
    
    try {
      setLoading(true);
      
      // Verify PIN with the server
      const { ok } = await api.verifyManagerPin(pin);
      
      if (!ok) {
        setMgrModal(prev => ({
          ...prev,
          error: 'Invalid manager PIN',
          pin: ''
        }));
        return;
      }
      
      // If PIN is valid, perform the action
      await performVoidOrComp(type, cartItem);
      
    } catch (error) {
      console.error('Failed to verify PIN:', error);
      setMgrModal(prev => ({
        ...prev,
        error: 'Failed to verify PIN. Please try again.',
        pin: ''
      }));
    } finally {
      setLoading(false);
    }
  };

  // Submit order to the server
  const submitOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Prepare order items
      const orderItems = cart.map(item => ({
        id: item.id,
        name: item.name,
        price: getUnitPrice(item, item.modifiers),
        quantity: item.quantity,
        modifiers: item.modifiers,
        station: getStationForItem(item),
        status: item.status || 'pending',
        compReason: item.compReason || ''
      }));
      
      // Submit to server
      await api.createOrder({
        table_id: tableId,
        items: orderItems,
        status: 'pending'
      });
      
      // Clear cart and navigate back
      setCart([]);
      navigate(`/tables`);
      
    } catch (error) {
      console.error('Failed to submit order:', error);
      setError(`Failed to submit order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Render cart item with actions
  const renderCartItem = (item) => (
    <div key={item.id} className="flex justify-between items-center p-2 border-b">
      <div>
        <div className="font-medium">{item.name}</div>
        <div className="text-sm text-gray-600">
          {item.quantity} x ${getUnitPrice(item, item.modifiers).toFixed(2)}
        </div>
      </div>
      <div />
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-100">Order for Table {tableId}</h1>
        <button
          onClick={() => navigate('/tables')}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-100 rounded border border-gray-700"
        >
          Back to Tables
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Menu Categories */}
        <div className="md:col-span-2 bg-gray-900 text-gray-100 rounded-lg shadow p-4 border border-gray-800">
          <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
            {Object.keys(menuItems).map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  activeCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {menuItems[activeCategory]?.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedItem(item);
                  setModifierOpen(!!item.modifiers);
                  if (!item.modifiers) {
                    addToCart(item);
                  }
                }}
                className="p-3 border border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-100 rounded-lg text-left"
              >
                <div className="text-2xl mb-1">{item.emoji}</div>
                <div className="font-medium">{item.name}</div>
                <div className="text-blue-600">${item.price.toFixed(2)}</div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Cart */}
        <div className="bg-gray-900 text-gray-100 rounded-lg shadow p-4 border border-gray-800">
          <h2 className="text-xl font-bold mb-4 text-gray-100">Order Summary</h2>
          
          {cart.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Your cart is empty</p>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {cart.map(renderCartItem)}
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between font-medium text-lg mb-4">
                  <span>Total:</span>
                  <span>
                    $
                    {cart
                      .reduce(
                        (sum, item) =>
                          sum + getUnitPrice(item, item.modifiers) * item.quantity,
                        0
                      )
                      .toFixed(2)}
                  </span>
                </div>
                
                <button
                  onClick={submitOrder}
                  disabled={loading || cart.length === 0}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Order'}
                </button>
                
                {error && (
                  <div className="mt-3 p-2 bg-red-900/40 text-red-300 border border-red-700 text-sm rounded">
                    {error}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Manager PIN Modal */}
      {mgrModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 text-gray-100 rounded-lg p-6 w-full max-w-md border border-gray-800 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">
              {mgrModal.type === 'void' ? 'Void Item' : 'Comp Item'}
            </h3>
            <form onSubmit={(e)=>{e.preventDefault(); handlePinSubmit();}}>
              <div className="mb-4">
                <p className="mb-2 text-gray-300">
                  {mgrModal.type === 'void' 
                    ? 'Are you sure you want to void this item?'
                    : 'Enter a reason for comping this item:'}
                </p>
                
                {mgrModal.type === 'comp' && (
                  <input
                    type="text"
                    value={mgrModal.reason}
                    onChange={(e) => 
                      setMgrModal(prev => ({ ...prev, reason: e.target.value }))
                    }
                    className="w-full p-2 rounded mb-4 bg-gray-800 text-gray-100 placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    placeholder="Reason for comp"
                    autoFocus
                  />
                )}
                
                <input
                  type="password"
                  value={mgrModal.pin}
                  onChange={(e) => 
                    setMgrModal(prev => ({ ...prev, pin: e.target.value }))
                  }
                  className="w-full p-2 rounded mb-2 bg-gray-800 text-gray-100 placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="Manager PIN"
                  autoFocus={mgrModal.type !== 'comp'}
                />
                
                {mgrModal.error && (
                  <p className="text-red-300 text-sm mt-1">{mgrModal.error}</p>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setMgrModal({ ...mgrModal, isOpen: false })}
                  className="px-4 py-2 text-gray-200 hover:bg-gray-800 border border-gray-700 rounded"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 ${
                    mgrModal.type === 'void' ? 'bg-red-600' : 'bg-yellow-600'
                  } text-white rounded hover:opacity-90`}
                  disabled={loading || (mgrModal.type === 'comp' && !mgrModal.reason) || !mgrModal.pin}
                >
                  {loading ? 'Processing...' : mgrModal.type === 'void' ? 'Void' : 'Comp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modifier Modal */}
      {modifierOpen && selectedItem?.modifiers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 text-gray-100 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-800">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">
              Customize {selectedItem.name}
            </h3>
            
            <div className="space-y-4">
              {Object.entries(selectedItem.modifiers).map(([group, def]) => (
                <div key={group}>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {group.charAt(0).toUpperCase() + group.slice(1)}
                  </label>
                  
                  {def.type === 'single' ? (
                    <select
                      className="w-full p-2 rounded bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                      value={modSelections[group] || ''}
                      onChange={(e) =>
                        setModSelections(prev => ({
                          ...prev,
                          [group]: e.target.value
                        }))
                      }
                    >
                      <option value="">Select {group}</option>
                      {def.options.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name} {opt.delta > 0 ? `(+$${opt.delta.toFixed(2)})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      {def.options.map(opt => (
                        <label key={opt.id} className="flex items-center text-gray-200">
                          <input
                            type="checkbox"
                            className="rounded text-blue-600"
                            checked={(modSelections[group] || []).includes(opt.id)}
                            onChange={(e) => {
                              const current = modSelections[group] || [];
                              setModSelections(prev => ({
                                ...prev,
                                [group]: e.target.checked
                                  ? [...current, opt.id]
                                  : current.filter(id => id !== opt.id)
                              }));
                            }}
                          />
                          <span className="ml-2">
                            {opt.name} {opt.delta > 0 ? `(+$${opt.delta.toFixed(2)})` : ''}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setModifierOpen(false)}
                className="px-4 py-2 text-gray-200 hover:bg-gray-800 border border-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  addToCart(selectedItem);
                  setModifierOpen(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add to Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderPage;
