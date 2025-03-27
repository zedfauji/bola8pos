import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function CreateOrder({ tableId }) {
  const [menuItems, setMenuItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const { data } = await api.get('/menu');
        setMenuItems(data);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, []);

  const addItem = (item) => {
    setSelectedItems([...selectedItems, { ...item, quantity: 1 }]);
  };

  const updateQuantity = (index, quantity) => {
    const updated = [...selectedItems];
    updated[index].quantity = quantity;
    setSelectedItems(updated);
  };

  const removeItem = (index) => {
    const updated = [...selectedItems];
    updated.splice(index, 1);
    setSelectedItems(updated);
  };

  const submitOrder = async () => {
    setSubmitting(true);
    try {
      await api.post('/orders', {
        tableId,
        items: selectedItems.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity
        }))
      });
      setSelectedItems([]);
      alert('Order submitted successfully!');
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading menu...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => addItem(item)}
            className="p-2 border rounded hover:bg-gray-50"
          >
            <div className="font-medium">{item.name}</div>
            <div className="text-sm text-gray-600">₱{item.price.toFixed(2)}</div>
          </button>
        ))}
      </div>

      {selectedItems.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h3 className="font-bold mb-2">Current Order</h3>
          <ul className="space-y-2">
            {selectedItems.map((item, index) => (
              <li key={index} className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{item.name}</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateQuantity(index, parseInt(e.target.value))}
                    className="ml-2 w-12 border rounded px-1"
                  />
                </div>
                <div className="flex items-center">
                  <span className="mr-2">₱{(item.price * item.quantity).toFixed(2)}</span>
                  <button
                    onClick={() => removeItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 font-bold text-right">
            Total: ₱{selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
          </div>
          <button
            onClick={submitOrder}
            disabled={submitting}
            className="mt-4 w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>
      )}
    </div>
  );
}
