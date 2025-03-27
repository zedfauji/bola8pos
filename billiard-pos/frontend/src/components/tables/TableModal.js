import { useState } from 'react';
import CreateOrder from '../orders/CreateOrder';

export default function TableModal({ table, onClose }) {
  const [activeTab, setActiveTab] = useState('orders');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Table {table.table_number}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ×
          </button>
        </div>
        
        <div className="border-b">
          <div className="flex">
            <button
              className={`px-4 py-2 ${activeTab === 'orders' ? 'border-b-2 border-blue-500' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              Orders
            </button>
            <button
              className={`px-4 py-2 ${activeTab === 'details' ? 'border-b-2 border-blue-500' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
          </div>
        </div>

        <div className="p-4">
          {activeTab === 'orders' ? (
            <CreateOrder tableId={table.id} />
          ) : (
            <div>
              <p><strong>Type:</strong> {table.table_type}</p>
              <p><strong>Status:</strong> {table.status}</p>
              {table.status === 'occupied' && (
                <p><strong>Duration:</strong> {Math.floor(table.current_session_minutes/60)}h {table.current_session_minutes%60}m</p>
              )}
              <p><strong>Hourly Rate:</strong> ₱{table.hourly_rate}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
