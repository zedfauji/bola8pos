import { useState } from 'react';
import api from '../../services/api';

export default function QuickOrder({ tableId }) {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const handleAddItem = async () => {
    if (!selectedItem || !quantity) return;
    
    try {
      await api.post('/orders', {
        tableId,
        items: [{ itemId: selectedItem.id, quantity }]
      });
      setItems([...items, { ...selectedItem, quantity }]);
      setQuantity(1);
    } catch (error) {
      console.error('Order failed:', error);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-semibold mb-3">Quick Order</h3>
      <div className="flex gap-2 mb-4">
        <select 
          className="flex-1 border p-2 rounded"
          onChange={(e) => setSelectedItem(JSON.parse(e.target.value))}
        >
          <option value="">Select item</option>
          {/* Populate with inventory items */}
        </select>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value))}
          className="w-16 border p-2 rounded"
        />
        <button 
          onClick={handleAddItem}
          className="bg-blue-500 text-white px-3 rounded"
        >
          Add
        </button>
      </div>
      
      <div className="border-t pt-3">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between py-1">
            <span>{item.name}</span>
            <span>{item.quantity} × ₱{item.unit_price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
